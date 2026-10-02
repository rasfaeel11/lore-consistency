import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppServer, listen } from "../../src/server/app.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));
const OPEN = "2026-09-30-cap-02-02";
const TOKEN = "token-de-teste";

// Todo pedido dos testes leva o token no cabeçalho, como a página faz.
// Os testes que querem ver a recusa usam globalThis.fetch direto.
function fetch(url: string, init: RequestInit = {}) {
  return globalThis.fetch(url, {
    ...init,
    headers: { "X-Lore-Pack-Token": TOKEN, ...(init.headers as Record<string, string> | undefined) },
  });
}

describe("servidor do app", () => {
  let tempDir: string;
  let story: string;
  let server: Server;
  let base: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
    cpSync(HISTORIA, story, { recursive: true });
    server = createAppServer(story, TOKEN);
    base = await listen(server, 0);
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(tempDir, { recursive: true, force: true });
  });

  function port(): number {
    return (server.address() as AddressInfo).port;
  }

  function postJson(path: string, body: unknown) {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function addReferencia() {
    mkdirSync(join(story, "referencias"));
    writeFileSync(
      join(story, "referencias", "magia.md"),
      "---\nid: magia\nnome: Magia\npalavras_chave: [Resto]\n---\nO Resto é o que sobra da alma.\n",
    );
  }

  // O fetch não deixa trocar o Host; o http.request deixa.
  function rawGet(path: string, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: port(), path, headers: { "X-Lore-Pack-Token": TOKEN, ...headers } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
  }

  it("escuta só em 127.0.0.1", () => {
    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
    expect(base).toBe(`http://127.0.0.1:${port()}`);
  });

  it("serve a página, o script e o estilo", async () => {
    const page = await fetch(`${base}/?token=${TOKEN}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("lore-pack");

    expect((await fetch(`${base}/app.js`)).headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${base}/style.css`)).headers.get("content-type")).toContain("text/css");
  });

  it("caminho desconhecido dá 404", async () => {
    expect((await fetch(`${base}/../package.json`)).status).toBe(404);
    expect((await fetch(`${base}/api/nada`)).status).toBe(404);
  });

  describe("token", () => {
    it("a página sem token, ou com token errado, dá 401", async () => {
      const semToken = await globalThis.fetch(`${base}/`);
      expect(semToken.status).toBe(401);
      expect(await semToken.text()).toContain("lore-pack ui");

      expect((await globalThis.fetch(`${base}/?token=errado`)).status).toBe(401);
    });

    it("o script e o estilo não precisam de token (não têm dado da história)", async () => {
      expect((await globalThis.fetch(`${base}/app.js`)).status).toBe(200);
      expect((await globalThis.fetch(`${base}/style.css`)).status).toBe(200);
    });

    it("a API sem o cabeçalho do token dá 401", async () => {
      const response = await globalThis.fetch(`${base}/api/historia`);

      expect(response.status).toBe(401);
      expect((await response.json()).erro).toContain("lore-pack ui");
    });

    it("token na URL não vale para a API (só o cabeçalho)", async () => {
      expect((await globalThis.fetch(`${base}/api/historia?token=${TOKEN}`)).status).toBe(401);
    });
  });

  describe("GET /api/historia", () => {
    it("lista os capítulos em ordem, com as sessões e o status", async () => {
      const response = await fetch(`${base}/api/historia`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.nome).toBe("historia");
      expect(body.capitulos).toEqual([
        { id: "cap-01", titulo: "A chegada", sessoes: [{ id: "2026-09-20-cap-01-01", status: "fechada" }] },
        {
          id: "cap-02",
          titulo: "O cais",
          sessoes: [
            { id: "2026-09-28-cap-02-01", status: "fechada" },
            { id: OPEN, status: "aberta" },
          ],
        },
      ]);
      expect(body.erros).toBe(0);
    });

    it("lista as referências para o formulário escolher", async () => {
      addReferencia();

      const body = await (await fetch(`${base}/api/historia`)).json();

      expect(body.referencias).toEqual([{ id: "magia", nome: "Magia" }]);
    });

    it("conta os erros da pasta para o app avisar", async () => {
      writeFileSync(join(story, "sessoes", OPEN, "sessao.md"), "sem cabeçalho");

      const body = await (await fetch(`${base}/api/historia`)).json();

      expect(body.erros).toBeGreaterThan(0);
    });
  });

  describe("GET /api/sessoes/:id", () => {
    it("devolve o cabeçalho, o corpo e o comando de início", async () => {
      const response = await fetch(`${base}/api/sessoes/${OPEN}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ id: OPEN, capitulo: "cap-02", status: "aberta" });
      expect(body.corpo).toContain("## Plano");
      expect(body.comando).toBe(`claude "Leia o arquivo sessoes/${OPEN}/pacote.md e siga as instruções dele."`);
    });

    it("sessão inexistente ou id inválido dá 404 com mensagem", async () => {
      const missing = await fetch(`${base}/api/sessoes/2026-01-01-cap-01-01`);
      expect(missing.status).toBe(404);
      expect((await missing.json()).erro).toContain("não existe");

      expect((await fetch(`${base}/api/sessoes/..%2F..%2Fbiblia`)).status).toBe(404);
    });
  });

  describe("GET /api/sessoes/:id/pacote", () => {
    it("devolve o texto do pacote", async () => {
      writeFileSync(join(story, "sessoes", OPEN, "pacote.md"), "<!-- lore-pack: x -->\nTexto do pacote");

      const response = await fetch(`${base}/api/sessoes/${OPEN}/pacote`);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Texto do pacote");
    });

    it("sem pacote.md dá 404", async () => {
      expect((await fetch(`${base}/api/sessoes/${OPEN}/pacote`)).status).toBe(404);
    });
  });

  describe("POST /api/sessoes", () => {
    it("cria a sessão com sessao.md e pacote.md", async () => {
      const response = await postJson("/api/sessoes", {
        capitulo: "cap-02",
        plano: "Ana encontra o capitão no farol.",
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.id).toMatch(/^\d{4}-\d{2}-\d{2}-cap-02-03$/);
      expect(body.resumo).toContain("Fichas no pacote");
      const folder = join(story, "sessoes", body.id);
      expect(readFileSync(join(folder, "sessao.md"), "utf8")).toContain("Ana encontra o capitão no farol.");
      expect(readFileSync(join(folder, "pacote.md"), "utf8")).toContain("id: ana-ferreira");
    });

    it("aceita as opções do pack", async () => {
      const response = await postJson("/api/sessoes", {
        capitulo: "cap-02",
        plano: "Ana encontra o capitão no farol.",
        sem: "ana-ferreira",
        semUltimaCena: true,
      });
      const { id } = await response.json();

      const pacote = readFileSync(join(story, "sessoes", id, "pacote.md"), "utf8");
      expect(pacote).not.toContain("id: ana-ferreira");
      expect(pacote).not.toContain("Aninha escondeu o mapa.");
    });

    it("aceita as referências escolhidas e o resumo mostra cada uma", async () => {
      addReferencia();

      const response = await postJson("/api/sessoes", {
        capitulo: "cap-02",
        plano: "Ana encontra o capitão no farol.",
        referencias: ["magia"],
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.resumo).toMatch(/magia\s+forçada/);
      expect(readFileSync(join(story, "sessoes", body.id, "pacote.md"), "utf8")).toContain("id: magia");
    });

    it("referência inexistente dá 400", async () => {
      const response = await postJson("/api/sessoes", { capitulo: "cap-02", plano: "Plano.", referencias: ["nada"] });

      expect(response.status).toBe(400);
      expect((await response.json()).erro).toContain('"nada"');
    });

    it("capítulo inexistente dá 400 com a mensagem do lore-pack e não cria nada", async () => {
      const before = readdirSync(join(story, "sessoes"));

      const response = await postJson("/api/sessoes", { capitulo: "cap-09", plano: "Plano." });

      expect(response.status).toBe(400);
      expect((await response.json()).erro).toContain('"cap-09" não existe');
      expect(readdirSync(join(story, "sessoes"))).toEqual(before);
    });

    it("plano vazio dá 400", async () => {
      const response = await postJson("/api/sessoes", { capitulo: "cap-02", plano: "  " });

      expect(response.status).toBe(400);
      expect((await response.json()).erro).toContain("plano");
    });

    it("JSON inválido dá 400", async () => {
      const response = await fetch(`${base}/api/sessoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{quebrado",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("guarda do cânone", () => {
    const ESTADO = () => join(story, "estado.md");

    it("sessão sem snapshot: vigiada false; vigiar tira o snapshot", async () => {
      const before = await (await fetch(`${base}/api/sessoes/${OPEN}/guarda`)).json();
      expect(before).toEqual({ vigiada: false, mudancas: [] });

      const response = await postJson(`/api/sessoes/${OPEN}/guarda/vigiar`, {});
      expect(response.status).toBe(200);

      const after = await (await fetch(`${base}/api/sessoes/${OPEN}/guarda`)).json();
      expect(after.vigiada).toBe(true);
      expect(after.desde).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("sessão criada pelo app já nasce vigiada e acusa a mudança com o diff", async () => {
      const { id } = await (await postJson("/api/sessoes", { capitulo: "cap-02", plano: "Ana no farol." })).json();
      writeFileSync(ESTADO(), "Mudado pela IA.\n");

      const body = await (await fetch(`${base}/api/sessoes/${id}/guarda`)).json();

      expect(body.vigiada).toBe(true);
      expect(body.mudancas).toEqual([
        { arquivo: "estado.md", tipo: "alterado", diff: expect.stringContaining("+ Mudado pela IA.") },
      ]);
    });

    it("reverter restaura e manter registra", async () => {
      await postJson(`/api/sessoes/${OPEN}/guarda/vigiar`, {});
      const original = readFileSync(ESTADO(), "utf8");
      writeFileSync(ESTADO(), "x");

      const reverted = await (await postJson(`/api/sessoes/${OPEN}/guarda/reverter`, {})).json();
      expect(reverted.arquivos).toEqual([{ arquivo: "estado.md", tipo: "alterado" }]);
      expect(readFileSync(ESTADO(), "utf8")).toBe(original);

      writeFileSync(ESTADO(), "y");
      const kept = await (await postJson(`/api/sessoes/${OPEN}/guarda/manter`, {})).json();
      expect(kept.arquivos).toEqual([{ arquivo: "estado.md", tipo: "alterado" }]);
      expect(readFileSync(join(story, "sessoes", OPEN, "alteracoes-diretas.md"), "utf8")).toContain("estado.md");
    });

    it("reverter sem snapshot dá 409", async () => {
      const response = await postJson(`/api/sessoes/${OPEN}/guarda/reverter`, {});

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("snapshot");
    });

    it("ações da guarda só aceitam POST em JSON", async () => {
      await postJson(`/api/sessoes/${OPEN}/guarda/vigiar`, {});
      writeFileSync(ESTADO(), "x");

      const response = await fetch(`${base}/api/sessoes/${OPEN}/guarda/reverter`, { method: "POST" });

      expect(response.status).toBe(415);
      expect(readFileSync(ESTADO(), "utf8")).toBe("x");
    });
  });

  describe("DELETE /api/sessoes/:id", () => {
    it("apaga a pasta da sessão e o snapshot, e ela some da lista", async () => {
      const { id } = await (await postJson("/api/sessoes", { capitulo: "cap-02", plano: "Ana no farol." })).json();
      expect(existsSync(join(story, ".lore-pack", "snapshots", id))).toBe(true);

      const response = await fetch(`${base}/api/sessoes/${id}`, { method: "DELETE" });

      expect(response.status).toBe(200);
      expect(existsSync(join(story, "sessoes", id))).toBe(false);
      expect(existsSync(join(story, ".lore-pack", "snapshots", id))).toBe(false);
      const historia = await (await fetch(`${base}/api/historia`)).json();
      expect(JSON.stringify(historia)).not.toContain(id);
    });

    it("apaga sessão fechada e sessão sem snapshot", async () => {
      const closed = "2026-09-28-cap-02-01";

      expect((await fetch(`${base}/api/sessoes/${closed}`, { method: "DELETE" })).status).toBe(200);
      expect((await fetch(`${base}/api/sessoes/${OPEN}`, { method: "DELETE" })).status).toBe(200);
      expect(existsSync(join(story, "sessoes", closed))).toBe(false);
      expect(existsSync(join(story, "sessoes", OPEN))).toBe(false);
    });

    it("recusa com 409 se a guarda tiver mudança não resolvida, e não apaga nada", async () => {
      await postJson(`/api/sessoes/${OPEN}/guarda/vigiar`, {});
      writeFileSync(join(story, "estado.md"), "Mudado pela IA.\n");

      const response = await fetch(`${base}/api/sessoes/${OPEN}`, { method: "DELETE" });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("estado.md");
      expect(existsSync(join(story, "sessoes", OPEN, "sessao.md"))).toBe(true);
    });

    it("sessão inexistente ou id inválido dá 404 e não apaga nada", async () => {
      expect((await fetch(`${base}/api/sessoes/2026-01-01-cap-01-01`, { method: "DELETE" })).status).toBe(404);
      expect((await fetch(`${base}/api/sessoes/..%2F..%2Fsessoes`, { method: "DELETE" })).status).toBe(404);
      expect(existsSync(join(story, "sessoes", OPEN))).toBe(true);
    });

    it("sem token dá 401 e não apaga", async () => {
      expect((await globalThis.fetch(`${base}/api/sessoes/${OPEN}`, { method: "DELETE" })).status).toBe(401);
      expect(existsSync(join(story, "sessoes", OPEN))).toBe(true);
    });
  });

  describe("proteções", () => {
    it("recusa POST que não seja JSON (formulário de outro site)", async () => {
      const response = await fetch(`${base}/api/sessoes`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ capitulo: "cap-02", plano: "x" }),
      });

      expect(response.status).toBe(415);
    });

    it("recusa pedido vindo de outra origem", async () => {
      const response = await fetch(`${base}/api/sessoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://site-qualquer.com" },
        body: JSON.stringify({ capitulo: "cap-02", plano: "x" }),
      });

      expect(response.status).toBe(403);
    });

    it("recusa Host que não seja o próprio computador", async () => {
      expect(await rawGet("/api/historia", { Host: "site-qualquer.com" })).toBe(403);
      expect(await rawGet("/api/historia", { Host: `localhost:${port()}` })).toBe(200);
    });
  });
});
