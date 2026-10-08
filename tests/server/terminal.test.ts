import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createAppServer, listen, shutdownApp } from "../../src/server/app.js";
import { loadNodePty } from "../../src/server/terminal.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));
const OPEN = "2026-09-30-cap-02-02";
const TOKEN = "token-de-teste";
const ptyAvailable = (await loadNodePty()).ok;
// Terminal de verdade no Windows (ConPTY) demora um pouco para subir.
const SLOW = { timeout: 30_000 };

// Scripts de "IA" de mentira, rodados pelo próprio node.
const SCRIPTS = {
  // Mostra o prompt recebido e a pasta de trabalho.
  eco: "console.log('PROMPT:' + process.argv[1]); console.log('CWD:' + process.cwd())",
  // Fica vivo até ser morto.
  vivo: "console.log('PID:' + process.pid); setInterval(() => {}, 1000)",
  // Como um programa de verdade, mostra algo antes de ler. Responde a uma linha e sai com 3.
  // (No Windows, o ConPTY só entrega a digitação depois que o processo escreveu na tela.)
  responde:
    "console.log('pronto'); process.stdin.on('data', (d) => { console.log('eco:' + d.toString().trim()); process.exit(3) })",
  // Abre um processo filho (como a IA abrindo um shell) e mostra os dois PIDs.
  neto:
    "const c = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log('PID:' + process.pid + ' NETO:' + c.pid); setInterval(() => {}, 1000)",
  // Mexe num arquivo protegido e sai.
  mexe: "require('fs').writeFileSync('estado.md', 'A IA mexeu.\\n'); console.log('feito')",
};

describe("terminal embutido", SLOW, () => {
  let tempDir: string;
  let story: string;
  let server: Server;
  let base: string;

  async function start(options?: Parameters<typeof createAppServer>[2]) {
    server = createAppServer(story, TOKEN, options);
    base = await listen(server, 0);
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
    cpSync(HISTORIA, story, { recursive: true });
  });

  afterEach(async () => {
    if (server) await shutdownApp(server);
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  function config(terminal: unknown) {
    writeFileSync(join(story, "lore-pack.config.json"), JSON.stringify({ terminal }));
  }
  const nodeScript = (script: keyof typeof SCRIPTS) =>
    config({ comando: process.execPath, args: ["-e", SCRIPTS[script], "{{prompt}}"] });

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { "X-Lore-Pack-Token": TOKEN, "Content-Type": "application/json", ...(init.headers as object) },
    });
  const openTerminal = async (body: unknown = {}) => {
    const response = await api(`/api/sessoes/${OPEN}/terminais`, { method: "POST", body: JSON.stringify(body) });
    return { response, body: await response.json() };
  };
  const port = () => (server.address() as AddressInfo).port;

  // Pedido de upgrade cru, para testar cabeçalhos que o cliente ws não deixa trocar.
  function rawUpgrade(path: string, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = request({
        host: "127.0.0.1",
        port: port(),
        path,
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
          ...headers,
        },
      });
      req.on("upgrade", (_res, socket) => {
        socket.destroy();
        resolve(101);
      });
      req.on("response", (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
  }

  // Cliente WebSocket que guarda tudo o que chega e espera por uma condição.
  function connect(id: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${port()}/ws/terminais/${id}?token=${TOKEN}`, { origin: base });
    const messages: { tipo: string; dados?: string; codigo?: number; mudancas?: string[] }[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    const output = () => messages.filter((m) => m.tipo === "saida").map((m) => m.dados).join("").replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r/g, "");
    const waitFor = async (check: () => boolean, what: string) => {
      const until = Date.now() + 20_000;
      while (!check()) {
        if (Date.now() > until) throw new Error(`Esperando ${what}. Recebido: ${JSON.stringify(output())}`);
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    const opened = new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const closed = new Promise<number>((resolve) => ws.once("close", (code) => resolve(code)));
    return { ws, messages, output, waitFor, opened, closed };
  }

  async function waitDead(pid: number) {
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      try {
        process.kill(pid, 0);
      } catch {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  describe("estado do terminal (GET /api/terminal)", () => {
    it.skipIf(!ptyAvailable)("ligado quando o comando existe", async () => {
      nodeScript("eco");
      await start();

      const body = await (await api("/api/terminal")).json();

      expect(body).toEqual({ ligado: true, comando: process.execPath });
    });

    it('desligado com "nenhum", explicando o motivo', async () => {
      config({ comando: "nenhum" });
      await start();

      const body = await (await api("/api/terminal")).json();

      expect(body.ligado).toBe(false);
      expect(body.motivo).toContain('"nenhum"');
      expect(body.motivo).toContain("Copiar pacote");
    });

    it("desligado com configuração inválida, mostrando o erro do arquivo", async () => {
      writeFileSync(join(story, "lore-pack.config.json"), "{ quebrado");
      await start();

      const body = await (await api("/api/terminal")).json();

      expect(body.ligado).toBe(false);
      expect(body.motivo).toContain("lore-pack.config.json");
    });

    it.skipIf(!ptyAvailable)("desligado se o comando não existe, dizendo o que instalar ou trocar", async () => {
      config({ comando: "ia-que-nao-existe-123" });
      await start();

      const body = await (await api("/api/terminal")).json();

      expect(body.ligado).toBe(false);
      expect(body.motivo).toContain('"ia-que-nao-existe-123"');
      expect(body.motivo).toContain("terminal.comando");
    });

    it("sem node-pty: o app funciona, o terminal fica desligado com o motivo", async () => {
      nodeScript("eco");
      await start({ loadPty: async () => ({ ok: false, reason: "Cannot find module 'node-pty'" }) });

      const status = await (await api("/api/terminal")).json();
      expect(status.ligado).toBe(false);
      expect(status.motivo).toContain("node-pty");
      expect(status.motivo).toContain("Copiar pacote");

      expect((await api("/api/historia")).status).toBe(200);
      const { response } = await openTerminal();
      expect(response.status).toBe(503);
    });
  });

  describe("abrir terminal (POST /api/sessoes/:id/terminais)", () => {
    it("sessão inexistente dá 404", async () => {
      nodeScript("eco");
      await start();

      const response = await api("/api/sessoes/2026-01-01-cap-01-01/terminais", { method: "POST", body: "{}" });

      expect(response.status).toBe(404);
    });

    it.skipIf(!ptyAvailable)(
      "roda o comando da configuração, na pasta da história, com o prompt de início",
      async () => {
        nodeScript("eco");
        await start();

        const { response, body } = await openTerminal();
        expect(response.status).toBe(201);
        const client = connect(body.id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain(`PROMPT:Leia o arquivo sessoes/${OPEN}/pacote.md`);
        expect(client.output().replace(/\n/g, "")).toContain(`CWD:${shownCwd(story)}`);
        expect(client.messages.find((m) => m.tipo === "fim")?.codigo).toBe(0);
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "ignora comando, argumentos, pasta e ambiente mandados pelo navegador",
      async () => {
        nodeScript("eco");
        await start();

        const { body } = await openTerminal({
          comando: "calc.exe",
          args: ["-e", "console.log('INVADIU')"],
          cwd: tempDir,
          env: { INVADIU: "1" },
        });
        const client = connect(body.id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain("PROMPT:");
        expect(client.output()).not.toContain("INVADIU");
        expect(client.output().replace(/\n/g, "")).toContain(`CWD:${shownCwd(story)}`);
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "passando de 4 terminais vivos, recusa com 429",
      async () => {
        nodeScript("vivo");
        await start();

        for (let i = 0; i < 4; i++) expect((await openTerminal()).response.status).toBe(201);
        const fifth = await openTerminal();

        expect(fifth.response.status).toBe(429);
        expect(fifth.body.erro).toContain("4");
      },
    );

    it.skipIf(!ptyAvailable)(
      "sessão sem snapshot passa a ser vigiada ao abrir o terminal",
      async () => {
        nodeScript("eco");
        await start();
        expect(existsSync(join(story, ".lore-pack", "snapshots", OPEN))).toBe(false);

        await openTerminal();

        expect(existsSync(join(story, ".lore-pack", "snapshots", OPEN, "manifest.json"))).toBe(true);
      },
    );
  });

  describe("correção do check (POST /api/problemas/terminais)", () => {
    const breakFicha = () => {
      mkdirSync(join(story, "fichas", "lugares"), { recursive: true });
      writeFileSync(join(story, "fichas", "lugares", "ilha.md"), "---\nid: ilha\ntipo: lugar\nnome: Ilha\nrelacionados: [farol]\n---\n");
    };

    it("com o terminal desligado, recusa e não grava nada na pasta", async () => {
      breakFicha();
      config({ comando: "nenhum" });
      await start();

      const response = await api("/api/problemas/terminais", { method: "POST", body: "{}" });

      expect(response.status).toBe(409);
      expect(existsSync(join(story, ".lore-pack", "correcao.md"))).toBe(false);
    });

    it.skipIf(!ptyAvailable)(
      "grava o pedido, abre a IA com ele, mostra o que ela mudou e desfaz",
      async () => {
        breakFicha();
        nodeScript("mexe");
        await start();
        const before = readFileSync(join(story, "estado.md"), "utf8");

        const response = await api("/api/problemas/terminais", { method: "POST", body: "{}" });
        expect(response.status).toBe(201);
        const client = connect((await response.json()).id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "guarda"), "a guarda da correção");

        expect(readFileSync(join(story, ".lore-pack", "correcao.md"), "utf8")).toContain('"farol" está em relacionados');
        expect(client.messages.find((m) => m.tipo === "guarda")?.mudancas).toEqual(["estado.md"]);
        const view = await (await api("/api/problemas")).json();
        expect(view.mudancas.map((m: { arquivo: string }) => m.arquivo)).toEqual(["estado.md"]);

        const reverted = await api("/api/problemas/reverter", { method: "POST", body: "{}" });
        expect(reverted.status).toBe(200);
        expect((await reverted.json()).mudancas).toEqual([]);
        expect(readFileSync(join(story, "estado.md"), "utf8")).toBe(before);
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "o terminal da correção recebe o prompt que manda ler o pedido",
      async () => {
        breakFicha();
        nodeScript("eco");
        await start();

        const response = await api("/api/problemas/terminais", { method: "POST", body: "{}" });
        const client = connect((await response.json()).id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain("PROMPT:Leia o arquivo .lore-pack/correcao.md");
        expect((await (await api("/api/terminais")).json())[0].sessao).toBe("correcao");
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "com uma correção rodando, recusa abrir outra e recusa desfazer",
      async () => {
        breakFicha();
        nodeScript("vivo");
        await start();
        await api("/api/problemas/terminais", { method: "POST", body: "{}" });

        const again = await api("/api/problemas/terminais", { method: "POST", body: "{}" });
        const revert = await api("/api/problemas/reverter", { method: "POST", body: "{}" });

        expect(again.status).toBe(409);
        expect(revert.status).toBe(409);
      },
    );
  });

  describe("conversa fora de sessão (POST /api/conversa/terminais)", () => {
    const talk = (body: unknown = {}) => api("/api/conversa/terminais", { method: "POST", body: JSON.stringify(body) });

    it("com o terminal desligado, recusa e não grava nada na pasta", async () => {
      config({ comando: "nenhum" });
      await start();

      const response = await talk({ assunto: "O que acontece com a Ana?" });

      expect(response.status).toBe(409);
      expect(existsSync(join(story, ".lore-pack"))).toBe(false);
    });

    it.skipIf(!ptyAvailable)(
      "sem assunto, abre a IA sem prompt nenhum e sem gravar pedido",
      async () => {
        nodeScript("eco");
        await start();

        const response = await talk();
        expect(response.status).toBe(201);
        const client = connect((await response.json()).id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain("PROMPT:undefined");
        expect(client.output().replace(/\n/g, "")).toContain(`CWD:${shownCwd(story)}`);
        expect(existsSync(join(story, ".lore-pack", "discussao.md"))).toBe(false);
        expect((await (await api("/api/terminais")).json())[0].sessao).toBe("conversa");
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "com assunto, grava o pedido com todas as fichas e abre a IA mandando ler",
      async () => {
        nodeScript("eco");
        await start();

        const response = await talk({ assunto: "O que acontece com a Ana?" });
        const client = connect((await response.json()).id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain("PROMPT:Leia o arquivo .lore-pack/discussao.md");
        const request = readFileSync(join(story, ".lore-pack", "discussao.md"), "utf8");
        expect(request).toContain("O que acontece com a Ana?");
        expect(request).toContain("fichas/personagens/ana-ferreira.md");
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "mostra o que a IA mudou e desfaz",
      async () => {
        nodeScript("mexe");
        await start();
        const before = readFileSync(join(story, "estado.md"), "utf8");

        const response = await talk();
        const client = connect((await response.json()).id);
        await client.waitFor(() => client.messages.some((m) => m.tipo === "guarda"), "a guarda da conversa");

        const view = await (await api("/api/conversa")).json();
        expect(view.mudancas.map((m: { arquivo: string }) => m.arquivo)).toEqual(["estado.md"]);

        const reverted = await api("/api/conversa/reverter", { method: "POST", body: "{}" });
        expect(reverted.status).toBe(200);
        expect((await reverted.json()).mudancas).toEqual([]);
        expect(readFileSync(join(story, "estado.md"), "utf8")).toBe(before);
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "com uma conversa rodando: abre outra sem tirar snapshot novo, e recusa desfazer",
      async () => {
        nodeScript("vivo");
        await start();
        await talk();
        const manifest = join(story, ".lore-pack", "snapshots", "conversa", "manifest.json");
        const first = readFileSync(manifest, "utf8");
        writeFileSync(join(story, "estado.md"), "Mudou no meio da conversa.\n");

        const again = await talk();
        const revert = await api("/api/conversa/reverter", { method: "POST", body: "{}" });

        expect(again.status).toBe(201);
        // O snapshot é o da primeira conversa: a mudança do meio continua sendo acusada.
        expect(readFileSync(manifest, "utf8")).toBe(first);
        expect(revert.status).toBe(409);
      },
    );
  });

  describe("WebSocket", () => {
    it("sem token, com token errado, Origin errada ou ausente e Host errado: recusa o upgrade", async () => {
      nodeScript("eco");
      await start();
      const path = (token: string) => `/ws/terminais/abc?token=${token}`;
      const origin = `http://127.0.0.1:${port()}`;

      expect(await rawUpgrade("/ws/terminais/abc", { Origin: origin })).toBe(401);
      expect(await rawUpgrade(path("errado"), { Origin: origin })).toBe(401);
      expect(await rawUpgrade(path(TOKEN), { Origin: "http://site-qualquer.com" })).toBe(403);
      expect(await rawUpgrade(path(TOKEN), {})).toBe(403);
      expect(await rawUpgrade(path(TOKEN), { Origin: origin, Host: "site-qualquer.com" })).toBe(403);
    });

    it("terminal inexistente: 404", async () => {
      nodeScript("eco");
      await start();

      expect(await rawUpgrade(`/ws/terminais/naoexiste?token=${TOKEN}`, { Origin: `http://127.0.0.1:${port()}` })).toBe(
        404,
      );
    });

    it.skipIf(!ptyAvailable)(
      "localhost também é aceito como Origin",
      async () => {
        nodeScript("vivo");
        await start();
        const { body } = await openTerminal();

        const status = await rawUpgrade(`/ws/terminais/${body.id}?token=${TOKEN}`, {
          Origin: `http://localhost:${port()}`,
          Host: `localhost:${port()}`,
        });

        expect(status).toBe(101);
      },
    );

    it.skipIf(!ptyAvailable)(
      "mensagem grande demais fecha a conexão com 1009",
      async () => {
        nodeScript("vivo");
        await start();
        const { body } = await openTerminal();
        const client = connect(body.id);
        await client.opened;

        client.ws.send(JSON.stringify({ tipo: "entrada", dados: "x".repeat(100_000) }));

        expect(await client.closed).toBe(1009);
      },
    );

    it.skipIf(!ptyAvailable)(
      "entrada chega ao processo; redimensionar não quebra; o código de saída volta",
      async () => {
        nodeScript("responde");
        await start();
        const { body } = await openTerminal();
        const client = connect(body.id);
        await client.waitFor(() => client.output().includes("pronto"), "o processo ficar pronto");

        client.ws.send(JSON.stringify({ tipo: "tamanho", colunas: 100, linhas: 40 }));
        client.ws.send(JSON.stringify({ tipo: "tamanho", colunas: -1, linhas: "x" }));
        client.ws.send("isto não é JSON");
        client.ws.send(JSON.stringify({ tipo: "entrada", dados: "oi\r" }));
        await client.waitFor(() => client.messages.some((m) => m.tipo === "fim"), "o fim do processo");

        expect(client.output()).toContain("eco:oi");
        expect(client.messages.find((m) => m.tipo === "fim")?.codigo).toBe(3);
        client.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "recarregar a página reanexa ao mesmo terminal e recebe a saída recente",
      async () => {
        nodeScript("vivo");
        await start();
        const { body } = await openTerminal();
        const first = connect(body.id);
        await first.waitFor(() => first.output().includes("PID:"), "o PID");
        first.ws.close();
        await first.closed;

        const second = connect(body.id);
        await second.waitFor(() => second.output().includes("PID:"), "a saída repetida");

        const list = await (await api("/api/terminais")).json();
        expect(list).toEqual([{ id: body.id, sessao: OPEN, rodando: true, codigo: null }]);
        second.ws.close();
      },
    );

    it.skipIf(!ptyAvailable)(
      "quando o processo termina, a guarda compara e avisa o que mudou",
      async () => {
        nodeScript("mexe");
        await start();
        const { body } = await openTerminal();
        const client = connect(body.id);

        await client.waitFor(() => client.messages.some((m) => m.tipo === "guarda"), "o aviso da guarda");

        expect(client.messages.find((m) => m.tipo === "guarda")?.mudancas).toEqual(["estado.md"]);
        expect(readFileSync(join(story, "estado.md"), "utf8")).toBe("A IA mexeu.\n");
        client.ws.close();
      },
    );
  });

  describe("ciclo de vida", () => {
    async function pidOf(id: string) {
      const client = connect(id);
      await client.waitFor(() => /PID:\d+/.test(client.output()), "o PID");
      const pid = Number(/PID:(\d+)/.exec(client.output())?.[1]);
      return { client, pid };
    }

    it.skipIf(!ptyAvailable)(
      "fechar a aba do terminal (DELETE) mata o processo e avisa quem estava conectado",
      async () => {
        nodeScript("vivo");
        await start();
        const { body } = await openTerminal();
        const { client, pid } = await pidOf(body.id);

        const response = await api(`/api/terminais/${body.id}`, { method: "DELETE" });

        expect(response.status).toBe(200);
        // O DELETE só responde depois que o processo morreu.
        expect(await waitDead(pid)).toBe(true);
        expect(await (await api("/api/terminais")).json()).toEqual([]);
        await client.closed;
      },
    );

    it.skipIf(!ptyAvailable)(
      "encerrar o servidor não deixa processo órfão",
      async () => {
        nodeScript("vivo");
        await start();
        const a = await pidOf((await openTerminal()).body.id);
        const b = await pidOf((await openTerminal()).body.id);

        await shutdownApp(server);

        expect(await waitDead(a.pid)).toBe(true);
        expect(await waitDead(b.pid)).toBe(true);
      },
    );

    it.skipIf(!ptyAvailable)("fechar o terminal mata também os processos que ele abriu", async () => {
      nodeScript("neto");
      await start();
      const { body } = await openTerminal();
      const client = connect(body.id);
      await client.waitFor(() => /NETO:\d+/.test(client.output()), "os PIDs");
      const [, pid, neto] = /PID:(\d+) NETO:(\d+)/.exec(client.output()) ?? [];

      await api(`/api/terminais/${body.id}`, { method: "DELETE" });

      expect(await waitDead(Number(pid))).toBe(true);
      expect(await waitDead(Number(neto))).toBe(true);
    });

    it.skipIf(!ptyAvailable)("não apaga uma sessão com terminal rodando", async () => {
      nodeScript("vivo");
      await start();
      const { body } = await openTerminal();

      const response = await api(`/api/sessoes/${OPEN}`, { method: "DELETE" });

      expect(response.status).toBe(409);
      expect((await response.json()).erro).toContain("terminal");
      expect(existsSync(join(story, "sessoes", OPEN, "sessao.md"))).toBe(true);

      await api(`/api/terminais/${body.id}`, { method: "DELETE" });
      expect((await api(`/api/sessoes/${OPEN}`, { method: "DELETE" })).status).toBe(200);
    });

    it("DELETE de terminal inexistente dá 404", async () => {
      nodeScript("eco");
      await start();

      expect((await api("/api/terminais/naoexiste", { method: "DELETE" })).status).toBe(404);
    });
  });
});

// A pasta como o processo a enxerga. No macOS, a pasta temporária fica atrás de um atalho
// (/var aponta para /private/var), e o process.cwd() do programa mostra o caminho de verdade.
function shownCwd(folder: string): string {
  return process.platform === "win32" ? folder : realpathSync(folder);
}
