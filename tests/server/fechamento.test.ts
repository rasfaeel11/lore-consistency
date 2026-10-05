import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { takeSnapshot } from "../../src/cli/guard.js";
import { createAppServer, listen, shutdownApp } from "../../src/server/app.js";
import { loadNodePty } from "../../src/server/terminal.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/apply/historia", import.meta.url));
const ID = "2026-10-01-cap-01-01";
const TOKEN = "token-de-teste";
const hasPty = (await loadNodePty()).ok;

// O fechamento.md do fixture tem 7 operações: 1 e 2 estado, 3 e 4 ficha ana-ferreira,
// 5 ficha_criar tobias-vau, 6 alfabeto, 7 nao_aprovado.

describe("app: fechamento da sessão", () => {
  let tempDir: string;
  let story: string;
  let server: Server;
  let base: string;
  let closingText: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
    cpSync(HISTORIA, story, { recursive: true });
    closingText = read(`sessoes/${ID}/fechamento.md`);
    server = createAppServer(story, TOKEN);
    base = await listen(server, 0);
  });

  afterEach(async () => {
    await shutdownApp(server);
    rmSync(tempDir, { recursive: true, force: true });
  });

  // Com "\n", como o servidor lê (o git pode ter trazido o fixture com quebras do Windows).
  function read(path: string): string {
    return readFileSync(join(story, path), "utf8").replace(/\r\n/g, "\n");
  }

  function get(path: string) {
    return fetch(`${base}${path}`, { headers: { "X-Lore-Pack-Token": TOKEN } });
  }

  function post(path: string, body: unknown, headers: Record<string, string> = { "X-Lore-Pack-Token": TOKEN }) {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  const route = (suffix = "") => `/api/sessoes/${ID}/fechamento${suffix}`;

  function block(...operations: string[]): string {
    return `Fechamento.\n\n\`\`\`lore-pack-mudancas\n{ "operacoes": [ ${operations.join(",\n")} ] }\n\`\`\`\n`;
  }

  const ONE_NAME = block('{ "op": "alfabeto_adicionar", "linhas": ["- Tobias Vau | faroleiro | costeiros | cap-01"] }');

  function removeClosing(): void {
    rmSync(join(story, "sessoes", ID, "fechamento.md"));
  }

  describe("GET /fechamento", () => {
    it("sem fechamento.md: existe = false", async () => {
      removeClosing();

      expect(await (await get(route())).json()).toEqual({
        existe: false,
        texto: null,
        operacoes: [],
        erro: null,
        pedidoCorrecao: null,
        aviso: null,
      });
    });

    it("com fechamento.md: o texto e a lista com o diff de cada operação, sem gravar nada", async () => {
      const estado = read("estado.md");

      const response = await get(route());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ existe: true, texto: closingText, erro: null, pedidoCorrecao: null });
      expect(body.operacoes).toHaveLength(7);
      expect(body.operacoes[0]).toEqual({
        indice: 1,
        op: "estado_adicionar",
        titulo: 'estado.md: acrescentar 1 linha em "Capítulos"',
        arquivo: "estado.md",
        tipo: "alterado",
        diff: expect.stringContaining("+ cap-01: Ana chega a Porto Sal e conhece o faroleiro."),
        erro: null,
        aplicada: false,
      });
      expect(body.operacoes[4]).toMatchObject({ indice: 5, arquivo: "fichas/personagens/tobias-vau.md", tipo: "criado" });
      expect(body.operacoes[6]).toMatchObject({ indice: 7, tipo: "informativo", diff: "- O farol ser assombrado." });
      expect(read("estado.md")).toBe(estado);
    });

    it("bloco inválido: o erro e o pedido de correção para colar na IA", async () => {
      writeFileSync(join(story, "sessoes", ID, "fechamento.md"), "Esqueci o bloco.\n");

      const body = await (await get(route())).json();

      expect(body).toMatchObject({ existe: true, texto: "Esqueci o bloco.\n", operacoes: [] });
      expect(body.erro).toContain("Não achei o bloco");
      expect(body.pedidoCorrecao).toContain("Reenvie só o bloco");
    });

    it("operação que não dá para aplicar vem com o motivo", async () => {
      writeFileSync(
        join(story, "sessoes", ID, "fechamento.md"),
        block('{ "op": "ficha_adicionar", "id": "ninguem", "secao": "Fatos", "linhas": ["x"] }'),
      );

      const body = await (await get(route())).json();

      expect(body.operacoes[0]).toMatchObject({ arquivo: null, diff: "" });
      expect(body.operacoes[0].erro).toContain('A ficha "ninguem" não existe');
    });

    it("com alteração direta não resolvida, devolve o aviso da guarda no lugar da lista", async () => {
      takeSnapshot(story, ID);
      writeFileSync(join(story, "biblia.md"), "# Bíblia\n\nMudada por fora.\n");

      const body = await (await get(route())).json();

      expect(body.operacoes).toEqual([]);
      expect(body.erro).toContain("biblia.md");
      expect(body.pedidoCorrecao).toBeNull();
    });
  });

  describe("POST /fechamento (salvar o texto colado)", () => {
    it("salva o texto como fechamento.md e devolve a lista", async () => {
      removeClosing();

      const response = await post(route(), { texto: ONE_NAME });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(read(`sessoes/${ID}/fechamento.md`)).toBe(ONE_NAME);
      expect(body).toMatchObject({ existe: true, texto: ONE_NAME });
      expect(body.operacoes).toHaveLength(1);
    });

    it("não sobrescreve um fechamento.md que já existe (409)", async () => {
      const response = await post(route(), { texto: ONE_NAME });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("Já existe");
      expect(read(`sessoes/${ID}/fechamento.md`)).toBe(closingText);
    });

    it("texto com bloco inválido não é salvo: 400 com o erro e o pedido de correção", async () => {
      removeClosing();

      const response = await post(route(), { texto: "Esqueci o bloco." });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.erro).toContain("Não achei o bloco");
      expect(body.pedidoCorrecao).toContain("Reenvie só o bloco");
      expect(existsSync(join(story, "sessoes", ID, "fechamento.md"))).toBe(false);
    });

    it("texto vazio: 400", async () => {
      removeClosing();

      expect((await post(route(), { texto: "  " })).status).toBe(400);
      expect((await post(route(), {})).status).toBe(400);
    });
  });

  describe("POST /fechamento/aplicar", () => {
    it("aplica só os índices pedidos, devolve o check e a lista atualizada, e não fecha a sessão", async () => {
      const response = await post(route("/aplicar"), { indices: [1, 3, 5] });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.aplicadas).toEqual([1, 3, 5]);
      expect(body.arquivos).toEqual(["estado.md", "fichas/personagens/ana-ferreira.md", "fichas/personagens/tobias-vau.md"]);
      expect(body.check).toContain("Tudo certo: 3 fichas validadas.");
      expect(body.erros).toBe(false);
      expect(body.operacoes.map((operation: { aplicada: boolean }) => operation.aplicada)).toEqual([true, false, true, false, true, false, false]);

      expect(read("estado.md")).toContain("cap-01: Ana chega a Porto Sal");
      expect(read("estado.md")).not.toContain("a lanterna apagada");
      expect(read("fichas/personagens/ana-ferreira.md")).toContain("- Conheceu o faroleiro Tobias (cap-01).");
      expect(read("fichas/personagens/ana-ferreira.md")).toContain("status: viva");
      expect(read("fichas/personagens/tobias-vau.md")).toContain("nome: Tobias Vau");
      expect(read("alfabeto.md")).not.toContain("Tobias Vau");
      expect(read(`sessoes/${ID}/sessao.md`)).toContain("status: aberta");
    });

    it("o navegador só diz quais índices: caminho, arquivo e operações mandados no corpo são ignorados", async () => {
      const biblia = read("biblia.md");

      const response = await post(route("/aplicar"), {
        indices: [6],
        arquivo: "biblia.md",
        caminho: "../fora.md",
        texto: block('{ "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["INJETADO"] }'),
        operacoes: [{ op: "estado_adicionar", secao: "Capítulos", linhas: ["INJETADO"] }],
      });

      expect(response.status).toBe(200);
      expect((await response.json()).arquivos).toEqual(["alfabeto.md"]);
      expect(read("alfabeto.md")).toContain("Tobias Vau");
      expect(read("estado.md")).not.toContain("INJETADO");
      expect(read("biblia.md")).toBe(biblia);
      expect(existsSync(join(tempDir, "fora.md"))).toBe(false);
    });

    it("aplicar de novo o mesmo índice é recusado, e nada duplica", async () => {
      await post(route("/aplicar"), { indices: [1] });
      const estado = read("estado.md");

      const response = await post(route("/aplicar"), { indices: [1] });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("A operação 1 já foi aplicada.");
      expect(read("estado.md")).toBe(estado);
    });

    it("índices inválidos: 400, sem gravar nada", async () => {
      const estado = read("estado.md");

      for (const indices of [[], ["1"], [1.5], [0], "todas", undefined]) {
        expect((await post(route("/aplicar"), { indices })).status, JSON.stringify(indices)).toBe(400);
      }
      expect(read("estado.md")).toBe(estado);
    });

    it("índice que não existe ou operação informativa: 409, sem gravar nada", async () => {
      const estado = read("estado.md");

      expect((await post(route("/aplicar"), { indices: [1, 99] })).status).toBe(409);
      expect((await post(route("/aplicar"), { indices: [7] })).status).toBe(409);
      expect(read("estado.md")).toBe(estado);
    });

    it("com alteração direta não resolvida, recusa", async () => {
      takeSnapshot(story, ID);
      writeFileSync(join(story, "biblia.md"), "# Bíblia\n\nMudada por fora.\n");
      const estado = read("estado.md");

      const response = await post(route("/aplicar"), { indices: [1] });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("biblia.md");
      expect(read("estado.md")).toBe(estado);
    });

    it("depois de aplicar, a guarda não acusa o que foi aprovado", async () => {
      takeSnapshot(story, ID);

      await post(route("/aplicar"), { indices: [1, 2, 3, 4, 5, 6] });

      const guard = await (await get(`/api/sessoes/${ID}/guarda`)).json();
      expect(guard).toMatchObject({ vigiada: true, mudancas: [] });
    });

    it.skipIf(!hasPty)("com terminal rodando na sessão, recusa (409): a IA ainda pode estar escrevendo", async () => {
      writeFileSync(
        join(story, "lore-pack.config.json"),
        JSON.stringify({ terminal: { comando: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] } }),
      );
      const opened = await post(`/api/sessoes/${ID}/terminais`, {});
      expect(opened.status).toBe(201);
      const estado = read("estado.md");

      const response = await post(route("/aplicar"), { indices: [1] });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("terminal rodando");
      expect(read("estado.md")).toBe(estado);
    });
  });

  describe("POST /fechar", () => {
    const closeRoute = `/api/sessoes/${ID}/fechar`;

    it("fecha a sessão, com o resumo", async () => {
      const response = await post(closeRoute, { resumo: "Ana conheceu o faroleiro." });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ fechada: ID });
      expect(read(`sessoes/${ID}/sessao.md`)).toContain("status: fechada");
      expect(read(`sessoes/${ID}/sessao.md`)).toContain("## Resumo\n\nAna conheceu o faroleiro.");
      const summary = await (await get("/api/historia")).json();
      expect(summary.capitulos[0].sessoes).toEqual([{ id: ID, status: "fechada" }]);
    });

    it("sessão já fechada: 409", async () => {
      await post(closeRoute, {});

      const response = await post(closeRoute, {});

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("já está fechada");
    });

    it("mostra a recusa da guarda", async () => {
      takeSnapshot(story, ID);
      writeFileSync(join(story, "biblia.md"), "# Bíblia\n\nMudada por fora.\n");

      const response = await post(closeRoute, {});

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("antes de fechar a sessão");
      expect(read(`sessoes/${ID}/sessao.md`)).toContain("status: aberta");
    });
  });

  it("fluxo completo: colar, listar, aplicar parte, fechar", async () => {
    removeClosing();
    takeSnapshot(story, ID);

    expect((await post(route(), { texto: closingText })).status).toBe(201);
    const listed = await (await get(route())).json();
    expect(listed.operacoes).toHaveLength(7);

    expect((await post(route("/aplicar"), { indices: [2, 4, 6] })).status).toBe(200);
    expect(read("estado.md")).toContain("a lanterna apagada");
    expect(read("estado.md")).not.toContain("cap-01: Ana chega");
    expect(read("fichas/personagens/ana-ferreira.md")).toContain("status: ferida");
    expect(existsSync(join(story, "fichas", "personagens", "tobias-vau.md"))).toBe(false);

    expect((await post(`/api/sessoes/${ID}/fechar`, {})).status).toBe(200);
    expect(read(`sessoes/${ID}/sessao.md`)).toContain("status: fechada");
  });

  it("exige token, JSON e sessão que existe", async () => {
    expect((await post(route("/aplicar"), { indices: [1] }, {})).status).toBe(401);
    expect((await post(`/api/sessoes/${ID}/fechar`, {}, {})).status).toBe(401);
    expect((await post(route("/aplicar"), { indices: [1] }, { "X-Lore-Pack-Token": TOKEN, "Content-Type": "text/plain" })).status).toBe(415);
    expect((await post(`/api/sessoes/${ID}/fechar`, {}, { "X-Lore-Pack-Token": TOKEN, "Content-Type": "text/plain" })).status).toBe(415);
    expect((await get("/api/sessoes/2026-10-01-cap-01-09/fechamento")).status).toBe(404);
    expect((await post("/api/sessoes/2026-10-01-cap-01-09/fechamento/aplicar", { indices: [1] })).status).toBe(404);
    expect((await post("/api/sessoes/..%2F..%2Fx/fechar", {})).status).toBe(404);
  });
});
