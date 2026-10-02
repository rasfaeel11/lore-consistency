import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ui } from "../../src/cli/ui.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

// Nos testes, "abrir o navegador" só anota o endereço.
const opened: string[] = [];
const fakeOpen = (url: string) => {
  opened.push(url);
};

describe("ui", () => {
  it("abre o servidor, mostra o endereço com o token e abre o navegador nele", async () => {
    opened.length = 0;
    const { result, server } = await ui(["--porta", "0", HISTORIA], fakeOpen);

    try {
      expect(result.exitCode).toBe(0);
      const url = /http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+/.exec(result.stdout)?.[0] ?? "";
      expect(url).not.toBe("");
      expect(result.stdout).toContain("Ctrl+C");
      expect(opened).toEqual([url]);
      const page = await fetch(url);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
    } finally {
      await new Promise((resolve) => server?.close(resolve));
    }
  });

  it("pasta que não é história dá erro e não abre servidor", async () => {
    const { result, server } = await ui(["--porta", "0", fileURLToPath(new URL(".", import.meta.url))], fakeOpen);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("biblia.md");
    expect(server).toBeUndefined();
  });

  it("porta inválida dá erro claro", async () => {
    const { result } = await ui(["--porta", "abc", HISTORIA], fakeOpen);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--porta");
  });

  it("porta ocupada dá erro claro", async () => {
    const busy = createServer();
    await new Promise<void>((resolve) => busy.listen(0, "127.0.0.1", resolve));
    const port = String((busy.address() as AddressInfo).port);

    try {
      const { result, server } = await ui(["--porta", port, HISTORIA], fakeOpen);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`porta ${port} já está em uso`);
      expect(server).toBeUndefined();
    } finally {
      await new Promise((resolve) => busy.close(resolve));
    }
  });

  it("cada execução gera um token diferente", async () => {
    const first = await ui(["--porta", "0", HISTORIA], fakeOpen);
    const second = await ui(["--porta", "0", HISTORIA], fakeOpen);

    try {
      const token = (stdout: string) => /token=([\w-]+)/.exec(stdout)?.[1];
      expect(token(first.result.stdout)).toBeDefined();
      expect(token(first.result.stdout)).not.toBe(token(second.result.stdout));
    } finally {
      await new Promise((resolve) => first.server?.close(resolve));
      await new Promise((resolve) => second.server?.close(resolve));
    }
  });

  it("--help mostra o uso", async () => {
    const { result } = await ui(["--help"], fakeOpen);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lore-pack ui");
  });
});
