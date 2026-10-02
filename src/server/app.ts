import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, join } from "node:path";
import { listChapters } from "../core/chapters.js";
import { buildStartPrompt, isSessionId, listSessions, readSession } from "../core/session.js";
import { readReferencias, validateStory } from "../core/validate.js";
import { readPackOptions } from "../cli/pack.js";
import { WEB_DIR } from "../cli/paths.js";
import { checkGuard, hasSnapshot, keepChanges, revertChanges, takeSnapshot } from "../cli/guard.js";
import { createSession } from "../cli/sessao.js";
import { isFile, readStoryFiles, readText } from "../cli/story-files.js";

// Princípio 8: o app só escuta no próprio computador.
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 1_000_000;

// A página manda o token neste cabeçalho em todo pedido à API.
export const TOKEN_HEADER = "x-lore-pack-token";

// Só estes arquivos são servidos. Lista fechada: nenhum caminho vindo do navegador vira caminho no disco.
// A página exige o token na URL; o script e o estilo não têm dado da história e ficam abertos.
const PAGE = { file: "index.html", type: "text/html; charset=utf-8" };
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

// Usado pelo verify:dist para conferir que o build tem tudo o que o servidor serve.
export const WEB_FILES = [PAGE.file, ...Object.values(STATIC_FILES).map((entry) => entry.file)];

const SESSION_ROUTE = /^\/api\/sessoes\/([^/]+)(\/pacote)?$/;
const GUARD_ROUTE = /^\/api\/sessoes\/([^/]+)\/guarda(?:\/(vigiar|reverter|manter))?$/;

export function createAppServer(root: string, token: string): Server {
  const server = createServer((req, res) => {
    handle(root, token, server, req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { erro: `Erro inesperado: ${message}` });
    });
  });
  return server;
}

// Começa a escutar em 127.0.0.1. Porta 0 deixa o sistema escolher (usado nos testes).
export function listen(server: Server, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      const address = server.address() as AddressInfo;
      resolve(`http://${HOST}:${address.port}`);
    });
  });
}

async function handle(
  root: string,
  token: string,
  server: Server,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Um site aberto no navegador pode tentar falar com o app. Recusamos se o Host
  // (truque de "DNS rebinding") ou a Origin não forem deste computador e desta porta.
  const { port } = server.address() as AddressInfo;
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(req.headers.host ?? "")) {
    return sendJson(res, 403, { erro: "Acesso permitido só pelo próprio computador." });
  }
  const origin = req.headers.origin;
  if (origin !== undefined && !hosts.some((host) => origin === `http://${host}`)) {
    return sendJson(res, 403, { erro: "Pedido vindo de outro site foi recusado." });
  }

  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  const staticFile = STATIC_FILES[path];
  if (method === "GET" && staticFile) return sendFile(res, staticFile);

  // Sem o token, outro programa ou outro usuário deste computador não usa o app.
  if (method === "GET" && path === "/") {
    if (!sameToken(url.searchParams.get("token"), token)) {
      res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end('Falta o token. Abra o endereço completo que o "lore-pack ui" imprimiu no terminal.\n');
      return;
    }
    return sendFile(res, PAGE);
  }
  if (path.startsWith("/api/") && !sameToken(headerValue(req.headers[TOKEN_HEADER]), token)) {
    return sendJson(res, 401, {
      erro: 'Falta o token. Abra o endereço completo que o "lore-pack ui" imprimiu no terminal.',
    });
  }

  if (method === "GET" && path === "/api/historia") return sendJson(res, 200, storySummary(root));
  if (method === "POST" && path === "/api/sessoes") return postSession(root, req, res);

  const guardMatch = GUARD_ROUTE.exec(path);
  if (guardMatch) {
    const id = decodeURIComponent(guardMatch[1] ?? "");
    const action = guardMatch[2];
    if (!isSessionId(id) || !isFile(join(root, "sessoes", id, "sessao.md"))) {
      return sendJson(res, 404, { erro: `A sessão "${id}" não existe em sessoes/.` });
    }
    if (method === "GET" && action === undefined) return getGuard(root, id, res);
    if (method === "POST" && action !== undefined) {
      if (!isJson(req)) return sendJson(res, 415, { erro: "Mande os dados como JSON." });
      return postGuard(root, id, action, res);
    }
  }

  const match = SESSION_ROUTE.exec(path);
  if (method === "GET" && match) {
    const id = decodeURIComponent(match[1] ?? "");
    return match[2] ? getPack(root, id, res) : getSession(root, id, res);
  }

  sendJson(res, 404, { erro: `Nada em ${path}.` });
}

function storySummary(root: string) {
  const files = readStoryFiles(root);
  const groups = listSessions(files);
  const sessionsOf = (capitulo: string) =>
    (groups.find((group) => group.capitulo === capitulo)?.sessions ?? []).map((s) => ({ id: s.id, status: s.status }));

  const chapters = listChapters(files);
  const capitulos = chapters.map((chapter) => ({ id: chapter.id, titulo: chapter.title, sessoes: sessionsOf(chapter.id) }));
  // Sessões de capítulo que não existe: aparecem sem título, para não sumirem (o check acusa).
  for (const group of groups.filter((g) => !chapters.some((c) => c.id === g.capitulo))) {
    capitulos.push({ id: group.capitulo, titulo: "", sessoes: sessionsOf(group.capitulo) });
  }

  const referencias = readReferencias(files).map((r) => ({ id: r.referencia.id, nome: r.referencia.nome }));
  const erros = validateStory(files).filter((problem) => problem.severity === "erro").length;
  return { nome: basename(root), capitulos, referencias, erros };
}

function getSession(root: string, id: string, res: ServerResponse): void {
  const sessionPath = join(root, "sessoes", id, "sessao.md");
  if (!isSessionId(id) || !isFile(sessionPath)) {
    return sendJson(res, 404, { erro: `A sessão "${id}" não existe em sessoes/.` });
  }
  const read = readSession(readText(sessionPath));
  if (!read.ok) return sendJson(res, 400, { erro: `sessoes/${id}/sessao.md: ${read.error}` });

  const packPath = `sessoes/${id}/pacote.md`;
  sendJson(res, 200, {
    ...read.session,
    corpo: read.body,
    pacote: isFile(join(root, packPath)) ? packPath : null,
    comando: `claude "${buildStartPrompt(packPath)}"`,
  });
}

function getPack(root: string, id: string, res: ServerResponse): void {
  const packPath = join(root, "sessoes", id, "pacote.md");
  if (!isSessionId(id) || !isFile(packPath)) {
    return sendJson(res, 404, { erro: `A sessão "${id}" não tem pacote.md.` });
  }
  res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" });
  res.end(readText(packPath));
}

async function postSession(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isJson(req)) return sendJson(res, 415, { erro: "Mande os dados como JSON." });
  const text = await readBody(req);
  if (text === undefined) return sendJson(res, 413, { erro: "Pedido grande demais." });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("não é um objeto");
    body = parsed as Record<string, unknown>;
  } catch {
    return sendJson(res, 400, { erro: "Os dados enviados não são um JSON válido." });
  }

  const capitulo = typeof body.capitulo === "string" ? body.capitulo : "";
  const plano = typeof body.plano === "string" ? body.plano.replace(/\r\n/g, "\n") : "";
  if (capitulo === "") return sendJson(res, 400, { erro: "Escolha o capítulo da sessão." });
  if (plano.trim() === "") return sendJson(res, 400, { erro: "Escreva o plano da cena antes de criar a sessão." });

  const options = readPackOptions({
    com: typeof body.com === "string" ? [body.com] : undefined,
    // As caixas de seleção chegam como lista de ids; o que não for texto é ignorado.
    ref: Array.isArray(body.referencias)
      ? body.referencias.filter((id): id is string => typeof id === "string")
      : undefined,
    sem: typeof body.sem === "string" ? [body.sem] : undefined,
    alfabeto: body.alfabeto === true,
    "sem-ultima-cena": body.semUltimaCena === true,
  });
  if (!options.ok) return sendJson(res, 400, { erro: options.error });

  const created = createSession({ ...options.options, root, capitulo, plan: plano });
  if (!created.ok) return sendJson(res, 400, { erro: created.error });
  sendJson(res, 201, { id: created.id, resumo: created.summary });
}

function getGuard(root: string, id: string, res: ServerResponse): void {
  const report = checkGuard(root, id);
  if (!report) return sendJson(res, 200, { vigiada: false, mudancas: [] });
  sendJson(res, 200, {
    vigiada: true,
    desde: report.since,
    mudancas: report.changes.map((change) => ({ arquivo: change.path, tipo: change.kind, diff: change.diff })),
  });
}

// vigiar tira um snapshot novo; reverter e manter exigem um snapshot existente.
// O clique no botão (com a confirmação na página) é a confirmação do princípio 4.
function postGuard(root: string, id: string, action: string, res: ServerResponse): void {
  if (action === "vigiar") return sendJson(res, 200, { desde: takeSnapshot(root, id) });
  if (!hasSnapshot(root, id)) {
    return sendJson(res, 409, { erro: `A sessão "${id}" não tem snapshot. Clique em "Começar a vigiar" primeiro.` });
  }
  const changes = action === "reverter" ? revertChanges(root, id) : keepChanges(root, id);
  sendJson(res, 200, { arquivos: changes.map((change) => ({ arquivo: change.path, tipo: change.kind })) });
}

function sendFile(res: ServerResponse, entry: { file: string; type: string }): void {
  res.writeHead(200, { "Content-Type": entry.type, "Cache-Control": "no-store" });
  res.end(readFileSync(join(WEB_DIR, entry.file)));
}

// Compara em tempo constante, para o tempo de resposta não dar pistas do token.
function sameToken(received: string | null | undefined, expected: string): boolean {
  if (typeof received !== "string") return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Formulários de outros sites não conseguem mandar application/json sem a permissão do servidor (CORS).
function isJson(req: IncomingMessage): boolean {
  return (req.headers["content-type"] ?? "").startsWith("application/json");
}

// Lê o corpo do pedido. Devolve undefined se passar do limite.
async function readBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
