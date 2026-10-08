import { timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { basename, join } from "node:path";
import { buildFixPrompt, extractChanges } from "../core/changes.js";
import { CHAPTER_ID, listChapters } from "../core/chapters.js";
import { DISCUSSION_FILE, DISCUSSION_START_PROMPT, TALK_ID, buildDiscussionPack, buildDiscussionRequest, discussionFiles } from "../core/discussion.js";
import { FIX_FILE, FIX_ID, FIX_START_PROMPT, buildFixRequest } from "../core/fix.js";
import { buildStartPrompt, isSessionId, listSessions, readSession } from "../core/session.js";
import { estimateTokens } from "../core/tokens.js";
import { readReferencias, validateStory } from "../core/validate.js";
import { applyClosing, readClosing } from "../cli/apply.js";
import { createChapter } from "../cli/capitulo.js";
import { formatReport } from "../cli/check.js";
import { applyInstructions, planInstructions } from "../cli/instrucoes.js";
import { openFolder } from "../cli/open-browser.js";
import { readPackOptions, writePack, type PackOptions } from "../cli/pack.js";
import { WEB_DIR } from "../cli/paths.js";
import { checkGuard, ensureLorePackDir, hasSnapshot, keepChanges, revertChanges, takeSnapshot } from "../cli/guard.js";
import { closeSessionFolder, createSession, deleteSession } from "../cli/sessao.js";
import { isFile, readStoryFiles, readText } from "../cli/story-files.js";
import { TerminalManager, loadNodePty, type OpenResult, type PtyLoad } from "./terminal.js";

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

// Arquivos do terminal no navegador, servidos direto do node_modules (sem copiar, sem build).
// Lista fechada, como a de cima. Os pacotes não têm "exports", então o caminho do arquivo resolve.
const require = createRequire(import.meta.url);
export const VENDOR_FILES: Record<string, { module: string; type: string }> = {
  "/vendor/xterm.mjs": { module: "@xterm/xterm/lib/xterm.mjs", type: "text/javascript; charset=utf-8" },
  "/vendor/xterm.css": { module: "@xterm/xterm/css/xterm.css", type: "text/css; charset=utf-8" },
  "/vendor/addon-fit.mjs": { module: "@xterm/addon-fit/lib/addon-fit.mjs", type: "text/javascript; charset=utf-8" },
};

// Usado pelo verify:dist para conferir que o build tem tudo o que o servidor serve.
export const WEB_FILES = [PAGE.file, ...Object.values(STATIC_FILES).map((entry) => entry.file)];

const SESSION_ROUTE = /^\/api\/sessoes\/([^/]+)(\/pacote)?$/;
const CLOSING_ROUTE = /^\/api\/sessoes\/([^/]+)\/(fechamento|fechamento\/aplicar|fechar)$/;
const GUARD_ROUTE = /^\/api\/sessoes\/([^/]+)\/guarda(?:\/(vigiar|reverter|manter))?$/;
const OPEN_TERMINAL_ROUTE = /^\/api\/sessoes\/([^/]+)\/terminais$/;
const TERMINAL_ROUTE = /^\/api\/terminais\/([0-9a-f]+)$/;
const TERMINAL_SOCKET_ROUTE = /^\/ws\/terminais\/([^/]+)$/;
// Mensagem do navegador para o terminal: digitação e tamanho da tela. 64 KB sobra.
const MAX_SOCKET_MESSAGE = 64 * 1024;

type App = {
  root: string;
  token: string;
  terminals: TerminalManager;
  sockets: WebSocketServer;
  openFolder: (folder: string) => void;
};
// Cada servidor guarda o seu app, para o shutdownApp achar os terminais dele.
const apps = new WeakMap<Server, App>();

export type AppOptions = {
  // Os testes trocam para simular o node-pty ausente.
  loadPty?: () => Promise<PtyLoad>;
  // Os testes trocam para não abrir o gerenciador de arquivos de verdade.
  openFolder?: (folder: string) => void;
};

export function createAppServer(root: string, token: string, options: AppOptions = {}): Server {
  const app: App = {
    root,
    token,
    terminals: new TerminalManager(root, options.loadPty ?? loadNodePty),
    sockets: new WebSocketServer({ noServer: true, maxPayload: MAX_SOCKET_MESSAGE }),
    openFolder: options.openFolder ?? openFolder,
  };
  const server = createServer((req, res) => {
    handle(app, server, req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { erro: `Erro inesperado: ${message}` });
    });
  });
  server.on("upgrade", (req, socket, head) => upgrade(app, server, req, socket, head));
  apps.set(server, app);
  return server;
}

// Ctrl+C (ou fechar a janela do terminal) no "lore-pack ui": encerra os terminais antes de sair.
// O "exit" é a última garantia: síncrono, mata pelo PID o que ainda estiver vivo.
export function stopOnExit(server: Server): void {
  const stop = () => {
    void shutdownApp(server).finally(() => process.exit(0));
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, stop);
  process.once("exit", () => apps.get(server)?.terminals.killAllNow());
}

// Encerra tudo: mata os terminais (nenhum processo fica órfão), fecha as conexões e o servidor.
// Pode ser chamado mais de uma vez.
export async function shutdownApp(server: Server): Promise<void> {
  const app = apps.get(server);
  await app?.terminals.closeAll();
  for (const ws of app?.sockets.clients ?? []) ws.terminate();
  server.closeAllConnections();
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
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

// Os endereços pelos quais o próprio app é acessado: 127.0.0.1 ou localhost, nesta porta.
function ownHosts(server: Server): string[] {
  const { port } = server.address() as AddressInfo;
  return [`127.0.0.1:${port}`, `localhost:${port}`];
}

async function handle(app: App, server: Server, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { root, token } = app;
  // Um site aberto no navegador pode tentar falar com o app. Recusamos se o Host
  // (truque de "DNS rebinding") ou a Origin não forem deste computador e desta porta.
  const hosts = ownHosts(server);
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
  const vendorFile = VENDOR_FILES[path];
  if (method === "GET" && vendorFile) return sendVendor(res, vendorFile);

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
  if (method === "POST" && path === "/api/capitulos") return postChapter(root, req, res);
  if (method === "POST" && path === "/api/pacote") return postPack(root, req, res);
  if (method === "GET" && path === "/api/instrucoes") return sendJson(res, 200, instructionsView(root));
  if (method === "POST" && path === "/api/instrucoes") return postInstructions(root, req, res);

  // Abre a pasta da história no gerenciador de arquivos. O navegador não manda caminho nenhum:
  // a pasta é sempre a que o "lore-pack ui" recebeu.
  if (method === "POST" && path === "/api/pasta/abrir") {
    if (!isJson(req)) return sendJson(res, 415, { erro: "Mande os dados como JSON." });
    app.openFolder(root);
    return sendJson(res, 200, { pasta: root });
  }

  // Problemas do check e a correção com a IA. Como no terminal das sessões, o navegador só
  // dispara: o pedido é montado aqui, a partir do check rodado aqui.
  if (method === "GET" && path === "/api/problemas") return sendJson(res, 200, problemsView(root));
  if (method === "POST" && (path === "/api/problemas/terminais" || path === "/api/problemas/reverter")) {
    if (!isJson(req)) return sendJson(res, 415, { erro: "Mande os dados como JSON." });
    // O snapshot da correção é um só: outra conversa ao mesmo tempo esconderia o que a primeira mudou.
    if (app.terminals.list().some((t) => t.sessao === FIX_ID && t.rodando)) {
      return sendJson(res, 409, { erro: "Já há uma correção rodando. Espere ela terminar ou feche o terminal dela." });
    }
    return path.endsWith("/reverter") ? postFixRevert(root, res) : postFixTerminal(app, req, res);
  }

  // Conversa fora de sessão: livre, ou para discutir os rumos. O navegador manda só o assunto,
  // que vira texto do pedido (como o plano de uma sessão), nunca comando nem argumento.
  if (method === "GET" && path === "/api/conversa") return sendJson(res, 200, talkView(root));
  if (method === "POST" && path === "/api/conversa/pedido") return postTalkPack(root, req, res);
  if (method === "POST" && path === "/api/conversa/terminais") return postTalkTerminal(app, req, res);
  if (method === "POST" && path === "/api/conversa/reverter") {
    if (!isJson(req)) return sendJson(res, 415, { erro: "Mande os dados como JSON." });
    // Com a IA ainda escrevendo, o que fosse desfeito poderia ser gravado de novo logo depois.
    if (talkRunning(app)) {
      return sendJson(res, 409, { erro: "Há uma conversa rodando. Feche o terminal dela antes de desfazer." });
    }
    return postTalkRevert(root, res);
  }

  // Terminal embutido. O navegador só diz QUAL sessão e, se houver mais de um programa no
  // lore-pack.config.json, o NOME de qual abrir. Comando, argumentos, pasta e ambiente vêm
  // sempre desse arquivo e do servidor.
  if (method === "GET" && path === "/api/terminal") return sendJson(res, 200, await app.terminals.status());
  if (method === "GET" && path === "/api/terminais") return sendJson(res, 200, app.terminals.list());
  const openMatch = OPEN_TERMINAL_ROUTE.exec(path);
  if (method === "POST" && openMatch) {
    const body = await readJson(req, res);
    if (!body) return;
    const id = decodeURIComponent(openMatch[1] ?? "");
    if (!isSessionId(id) || !isFile(join(root, "sessoes", id, "sessao.md"))) {
      return sendJson(res, 404, { erro: `A sessão "${id}" não existe em sessoes/.` });
    }
    return sendOpened(res, await app.terminals.open(id, undefined, readChoice(body)));
  }
  const terminalMatch = TERMINAL_ROUTE.exec(path);
  if (method === "DELETE" && terminalMatch) {
    const closed = await app.terminals.close(terminalMatch[1] ?? "");
    return closed ? sendJson(res, 200, { fechado: terminalMatch[1] }) : sendJson(res, 404, { erro: "Esse terminal não existe (já foi fechado?)." });
  }

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

  // Fechamento: o navegador só diz QUAL sessão e QUAIS números da lista. O texto das operações,
  // os caminhos e os conteúdos vêm sempre do fechamento.md lido aqui no servidor.
  const closingMatch = CLOSING_ROUTE.exec(path);
  if (closingMatch) {
    const id = decodeURIComponent(closingMatch[1] ?? "");
    const action = closingMatch[2];
    if (!isSessionId(id) || !isFile(join(root, "sessoes", id, "sessao.md"))) {
      return sendJson(res, 404, { erro: `A sessão "${id}" não existe em sessoes/.` });
    }
    if (method === "GET" && action === "fechamento") return sendJson(res, 200, closingView(root, id));
    if (method === "POST" && action === "fechamento") return postClosing(root, id, req, res);
    if (method === "POST" && action === "fechamento/aplicar") {
      // A IA ainda pode estar escrevendo o fechamento.md, e o snapshot novo esconderia o que ela fizer.
      if (app.terminals.list().some((t) => t.sessao === id && t.rodando)) {
        return sendJson(res, 409, { erro: "Esta sessão tem um terminal rodando. Feche o terminal antes de aplicar o fechamento." });
      }
      return postClosingApply(root, id, req, res);
    }
    if (method === "POST" && action === "fechar") return postCloseSession(root, id, req, res);
  }

  const match = SESSION_ROUTE.exec(path);
  if (method === "DELETE" && match && !match[2]) {
    const id = decodeURIComponent(match[1] ?? "");
    // A IA continuaria escrevendo numa pasta que não existe mais, sem guarda.
    if (app.terminals.list().some((t) => t.sessao === id && t.rodando)) {
      return sendJson(res, 409, { erro: "Esta sessão tem um terminal rodando. Feche o terminal antes de apagar a sessão." });
    }
    return removeSession(root, id, res);
  }
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
  const problems = validateStory(files);
  const erros = problems.filter((problem) => problem.severity === "erro").length;
  return { nome: basename(root), pasta: root, capitulos, referencias, erros, avisos: problems.length - erros };
}

// --- Problemas do check, e a correção com a IA numa conversa nova ---

function problemsView(root: string) {
  const files = readStoryFiles(root);
  const problems = validateStory(files);
  const erros = problems.filter((problem) => problem.severity === "erro").length;
  const report = formatReport(problems, files);
  // O que mudou desde a última correção pedida (sem nenhuma, não há o que mostrar).
  const guard = checkGuard(root, FIX_ID);
  return {
    erros,
    avisos: problems.length - erros,
    relatorio: report,
    // Para colar em outra IA, quando o terminal está desligado.
    pedido: problems.length > 0 ? buildFixRequest(report) : null,
    desde: guard?.since ?? null,
    mudancas: (guard?.changes ?? []).map((change) => ({ arquivo: change.path, tipo: change.kind, diff: change.diff })),
  };
}

// Grava o pedido em .lore-pack/correcao.md, guarda uma cópia dos arquivos e abre a IA.
async function postFixTerminal(app: App, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const view = problemsView(app.root);
  if (view.pedido === null) return sendJson(res, 409, { erro: "O check não achou nenhum problema: não há o que corrigir." });
  // Confere antes de gravar qualquer coisa: com o terminal desligado, nada muda na pasta.
  const status = await app.terminals.status();
  if (!status.ligado) return sendJson(res, 409, { erro: status.motivo });

  ensureLorePackDir(app.root);
  writeFileSync(join(app.root, FIX_FILE), view.pedido);
  // Snapshot novo a cada correção: o "Desfazer" volta ao estado de antes desta conversa.
  takeSnapshot(app.root, FIX_ID);

  sendOpened(res, await app.terminals.open(FIX_ID, FIX_START_PROMPT, readChoice(body)));
}

// O nome de um programa do lore-pack.config.json. É só o que o navegador escolhe: o servidor
// procura o nome no arquivo, e nome que não está lá não abre nada.
function readChoice(body: Record<string, unknown>): string | undefined {
  return typeof body.terminal === "string" && body.terminal !== "" ? body.terminal : undefined;
}

function sendOpened(res: ServerResponse, opened: OpenResult): void {
  if (opened.ok) return sendJson(res, 201, { id: opened.id, nome: opened.nome });
  sendJson(res, opened.status, { erro: opened.error });
}

// O segundo clique em "Desfazer" na página é a confirmação do princípio 4.
function postFixRevert(root: string, res: ServerResponse): void {
  if (!hasSnapshot(root, FIX_ID)) return sendJson(res, 409, { erro: "Nenhuma correção foi pedida ainda: não há o que desfazer." });
  const changes = revertChanges(root, FIX_ID);
  sendJson(res, 200, { arquivos: changes.map((change) => ({ arquivo: change.path, tipo: change.kind })), ...problemsView(root) });
}

// --- Conversa com a IA fora de sessão ---

function talkRunning(app: App): boolean {
  return app.terminals.list().some((t) => t.sessao === TALK_ID && t.rodando);
}

function talkView(root: string) {
  const { fichas, referencias } = discussionFiles(readStoryFiles(root));
  // O que mudou desde que a conversa mais antiga ainda aberta começou (sem nenhuma, nada a mostrar).
  const guard = checkGuard(root, TALK_ID);
  return {
    fichas: fichas.length,
    referencias: referencias.length,
    desde: guard?.since ?? null,
    mudancas: (guard?.changes ?? []).map((change) => ({ arquivo: change.path, tipo: change.kind, diff: change.diff })),
  };
}

function readTopic(body: Record<string, unknown>): string {
  return typeof body.assunto === "string" ? body.assunto.replace(/\r\n/g, "\n").trim() : "";
}

// Para colar em outra IA (princípio 9): o pedido com o texto de tudo. Não grava nada.
async function postTalkPack(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const topic = readTopic(body);
  if (topic === "") return sendJson(res, 400, { erro: "Escreva o que você quer decidir antes de copiar o pedido." });

  const modelPath = join(root, "modelos", "ficha-modelo.md");
  const text = buildDiscussionPack(topic, readStoryFiles(root), isFile(modelPath) ? readText(modelPath) : undefined);
  sendJson(res, 200, { texto: text, tokens: estimateTokens(text) });
}

// Com assunto, grava o pedido da discussão e abre a IA mandando ler. Sem assunto, abre a IA sem prompt.
async function postTalkTerminal(app: App, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const topic = readTopic(body);
  // Confere antes de gravar qualquer coisa: com o terminal desligado, nada muda na pasta.
  const status = await app.terminals.status();
  if (!status.ligado) return sendJson(res, 409, { erro: status.motivo });

  // Snapshot novo só na primeira conversa: com outra ainda rodando, ele esconderia o que ela já mudou.
  if (!talkRunning(app)) takeSnapshot(app.root, TALK_ID);
  if (topic !== "") {
    ensureLorePackDir(app.root);
    writeFileSync(join(app.root, DISCUSSION_FILE), buildDiscussionRequest(topic, readStoryFiles(app.root)));
  }

  sendOpened(res, await app.terminals.open(TALK_ID, topic === "" ? "" : DISCUSSION_START_PROMPT, readChoice(body)));
}

// O segundo clique em "Desfazer" na página é a confirmação do princípio 4.
function postTalkRevert(root: string, res: ServerResponse): void {
  if (!hasSnapshot(root, TALK_ID)) return sendJson(res, 409, { erro: "Nenhuma conversa foi aberta ainda: não há o que desfazer." });
  const changes = revertChanges(root, TALK_ID);
  sendJson(res, 200, { arquivos: changes.map((change) => ({ arquivo: change.path, tipo: change.kind })), ...talkView(root) });
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
    comando: `claude "${buildStartPrompt(id)}"`,
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
  const body = await readJson(req, res);
  if (!body) return;

  const capitulo = typeof body.capitulo === "string" ? body.capitulo : "";
  const plano = readPlan(body);
  if (capitulo === "") return sendJson(res, 400, { erro: "Escolha o capítulo da sessão." });
  if (plano.trim() === "") return sendJson(res, 400, { erro: "Escreva o plano da cena antes de criar a sessão." });

  const options = packOptionsFromBody(body);
  if (!options.ok) return sendJson(res, 400, { erro: options.error });

  const created = createSession({ ...options.options, root, capitulo, plan: plano });
  if (!created.ok) return sendJson(res, 400, { erro: created.error });
  sendJson(res, 201, { id: created.id, resumo: created.summary });
}

function readPlan(body: Record<string, unknown>): string {
  return typeof body.plano === "string" ? body.plano.replace(/\r\n/g, "\n") : "";
}

// As opções do pack que o formulário manda, no formato que a CLI já sabe ler.
function packOptionsFromBody(body: Record<string, unknown>): { ok: true; options: PackOptions } | { ok: false; error: string } {
  // O campo do limite chega como texto; vazio é "sem limite".
  const limite = typeof body.limite === "string" ? body.limite.trim() : "";
  const options = readPackOptions({
    com: typeof body.com === "string" ? [body.com] : undefined,
    // As caixas de seleção chegam como lista de ids; o que não for texto é ignorado.
    ref: Array.isArray(body.referencias)
      ? body.referencias.filter((id): id is string => typeof id === "string")
      : undefined,
    sem: typeof body.sem === "string" ? [body.sem] : undefined,
    alfabeto: body.alfabeto === true,
    "sem-ultima-cena": body.semUltimaCena === true,
    limite: limite === "" ? undefined : limite,
  });
  // A mensagem da CLI cita a flag; na página, o campo tem outro nome.
  if (!options.ok) return { ok: false, error: "O limite de tokens precisa ser um número inteiro, por exemplo: 8000." };
  return options;
}

// O "pack" da CLI: monta o pacote sem criar sessão. O arquivo vai para .lore-pack/, fora da
// história, e o texto volta para a página copiar. Nada do autor é alterado.
async function postPack(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const plano = readPlan(body);
  if (plano.trim() === "") return sendJson(res, 400, { erro: "Escreva o plano da cena antes de montar o pacote." });
  const options = packOptionsFromBody(body);
  if (!options.ok) return sendJson(res, 400, { erro: options.error });

  // Com o capítulo escolhido no formulário, a última cena sai dele (ou dos anteriores).
  const chapter = typeof body.capitulo === "string" && CHAPTER_ID.test(body.capitulo) ? body.capitulo : undefined;
  const output = join(ensureLorePackDir(root), "pacote.md");
  const result = writePack({ ...options.options, root, plan: plano, output, chapter });
  if (result.exitCode !== 0) return sendJson(res, 400, { erro: result.stderr.trimEnd() });
  sendJson(res, 200, { texto: readText(output), resumo: result.stdout });
}

// --- Instruções para a IA: o "atualizar-instrucoes" da CLI ---

function instructionsView(root: string) {
  return { arquivos: planInstructions(root).map((plan) => ({ arquivo: plan.path, acao: plan.action, diff: plan.diff })) };
}

// Arquivo que o autor editou só é trocado com "sobrescrever", depois de ele ver o diff na página (princípio 4).
async function postInstructions(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const plans = planInstructions(root);
  const edited = plans.filter((plan) => plan.action === "editado").map((plan) => plan.path);
  if (edited.length > 0 && body.sobrescrever !== true) {
    return sendJson(res, 409, {
      erro: `Você editou ${edited.join(", ")} depois que o lore-pack gravou. Para não perder o seu texto, nada foi gravado.`,
      ...instructionsView(root),
    });
  }
  const changed = applyInstructions(root, plans);
  sendJson(res, 200, { gravados: changed.map((plan) => plan.path), ...instructionsView(root) });
}

// O "capitulo novo" da CLI. O navegador só manda o título: o nome do arquivo é sempre o próximo cap-NN.
async function postChapter(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const titulo = typeof body.titulo === "string" ? body.titulo : "";
  if (titulo.trim() === "") return sendJson(res, 400, { erro: "Escreva o título do capítulo." });

  const created = createChapter(root, titulo);
  sendJson(res, 201, { id: created.id, titulo: created.title });
}

// DELETE não é um método que outro site consiga mandar sem permissão de CORS, e ainda exige o token.
// A confirmação do autor (princípio 4) é o segundo clique na página.
function removeSession(root: string, id: string, res: ServerResponse): void {
  const deleted = deleteSession(root, id);
  if (deleted.ok) return sendJson(res, 200, { apagada: id });
  sendJson(res, deleted.reason === "nao-existe" ? 404 : 409, { erro: deleted.error });
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

// --- Fechamento: as mudanças que a IA propôs e o autor escolhe aplicar ---

// O que a página mostra: o texto do fechamento.md e o que cada operação faria. Não grava nada.
function closingView(root: string, id: string) {
  const path = join(root, "sessoes", id, "fechamento.md");
  if (!isFile(path)) return { existe: false, texto: null, operacoes: [], erro: null, pedidoCorrecao: null, aviso: null };

  const closing = readClosing(root, id);
  const base = { existe: true, texto: readText(path) };
  if (!closing.ok) return { ...base, operacoes: [], erro: closing.error, pedidoCorrecao: closing.fixPrompt ?? null, aviso: null };
  return {
    ...base,
    operacoes: closing.items.map((item) => ({
      indice: item.index,
      op: item.op,
      titulo: item.title,
      arquivo: item.path,
      tipo: item.kind,
      diff: item.diff,
      erro: item.error ?? null,
      aplicada: item.applied,
    })),
    erro: null,
    pedidoCorrecao: null,
    aviso: closing.replaced
      ? "O fechamento.md mudou desde a última vez que algo foi aplicado. Ele está sendo tratado como um fechamento novo."
      : null,
  };
}

// Salva o texto colado como sessoes/<id>/fechamento.md. Nunca por cima de um que já existe,
// e só se o bloco puder ser lido: um arquivo ruim salvo aqui não poderia ser trocado pela página.
async function postClosing(root: string, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const text = typeof body.texto === "string" ? body.texto.replace(/\r\n/g, "\n") : "";
  if (text.trim() === "") return sendJson(res, 400, { erro: "Cole a resposta da IA ao prompt 04-fechar-sessao antes." });

  const path = join(root, "sessoes", id, "fechamento.md");
  if (isFile(path)) {
    return sendJson(res, 409, {
      erro: `Já existe sessoes/${id}/fechamento.md. Para não apagar esse texto, nada foi alterado. Para usar outro, edite o arquivo.`,
    });
  }
  const extracted = extractChanges(text);
  if (!extracted.ok) return sendJson(res, 400, { erro: extracted.error, pedidoCorrecao: buildFixPrompt(extracted.error) });

  writeFileSync(path, text);
  sendJson(res, 201, closingView(root, id));
}

// O segundo clique em "Aplicar selecionadas" é a confirmação do princípio 4.
async function postClosingApply(root: string, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const indices = body.indices;
  if (!Array.isArray(indices) || indices.length === 0 || !indices.every((index) => Number.isInteger(index) && index >= 1)) {
    return sendJson(res, 400, { erro: "Marque pelo menos uma operação da lista para aplicar." });
  }

  const applied = applyClosing(root, id, indices as number[]);
  if (!applied.ok) return sendJson(res, 409, { erro: applied.error });
  sendJson(res, 200, {
    aplicadas: applied.applied,
    arquivos: applied.written,
    check: applied.report,
    erros: applied.hasErrors,
    ...closingView(root, id),
  });
}

// Fechar é uma ação à parte do aplicar: com aplicação parcial, o autor pode querer continuar.
async function postCloseSession(root: string, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req, res);
  if (!body) return;
  const resumo = typeof body.resumo === "string" ? body.resumo.replace(/\r\n/g, "\n") : undefined;

  const closed = closeSessionFolder(root, id, { resumo });
  if (!closed.ok) return sendJson(res, 409, { erro: closed.error });
  sendJson(res, 200, { fechada: id });
}

function sendFile(res: ServerResponse, entry: { file: string; type: string }): void {
  res.writeHead(200, { "Content-Type": entry.type, "Cache-Control": "no-store" });
  res.end(readFileSync(join(WEB_DIR, entry.file)));
}

function sendVendor(res: ServerResponse, entry: { module: string; type: string }): void {
  let file: string;
  try {
    file = require.resolve(entry.module);
  } catch {
    return sendJson(res, 404, { erro: `Falta o pacote ${entry.module.split("/").slice(0, 2).join("/")}. Reinstale o lore-pack.` });
  }
  res.writeHead(200, { "Content-Type": entry.type, "Cache-Control": "no-store" });
  res.end(readFileSync(file));
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

// Lê o corpo de um POST como objeto JSON. Com problema, responde o erro e devolve undefined.
async function readJson(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | undefined> {
  if (!isJson(req)) {
    sendJson(res, 415, { erro: "Mande os dados como JSON." });
    return undefined;
  }
  const text = await readBody(req);
  if (text === undefined) {
    sendJson(res, 413, { erro: "Pedido grande demais." });
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("não é um objeto");
    return parsed as Record<string, unknown>;
  } catch {
    sendJson(res, 400, { erro: "Os dados enviados não são um JSON válido." });
    return undefined;
  }
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

// Pedido para abrir o WebSocket de um terminal. Qualquer página aberta no navegador consegue
// tentar um WebSocket para 127.0.0.1, e o navegador não aplica CORS a WebSocket. Por isso,
// antes de aceitar: Host deste computador, Origin exatamente o próprio app (obrigatória),
// token certo (vem na URL, porque o navegador não deixa pôr cabeçalho em WebSocket) e terminal que existe.
function upgrade(app: App, server: Server, req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const refuse = (status: number, text: string) => {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };
  const hosts = ownHosts(server);
  if (!hosts.includes(req.headers.host ?? "")) return refuse(403, "Forbidden");
  if (!hosts.some((host) => req.headers.origin === `http://${host}`)) return refuse(403, "Forbidden");

  const url = new URL(req.url ?? "/", `http://${HOST}`);
  if (!sameToken(url.searchParams.get("token"), app.token)) return refuse(401, "Unauthorized");
  const match = TERMINAL_SOCKET_ROUTE.exec(url.pathname);
  const id = match?.[1] ?? "";
  if (!match || !app.terminals.has(id)) return refuse(404, "Not Found");

  app.sockets.handleUpgrade(req, socket, head, (ws) => app.terminals.attach(id, ws));
}
