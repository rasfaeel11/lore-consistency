import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { app } from "../../src/cli/app.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

describe("app", () => {
  it("abre o servidor e mostra o endereço", async () => {
    const { result, server } = await app(["--porta", "0", HISTORIA]);

    try {
      expect(result.exitCode).toBe(0);
      const url = /http:\/\/127\.0\.0\.1:\d+/.exec(result.stdout)?.[0] ?? "";
      expect(url).not.toBe("");
      expect(result.stdout).toContain("Ctrl+C");
      expect((await fetch(`${url}/api/historia`)).status).toBe(200);
    } finally {
      await new Promise((resolve) => server?.close(resolve));
    }
  });

  it("pasta que não é história dá erro e não abre servidor", async () => {
    const { result, server } = await app(["--porta", "0", fileURLToPath(new URL(".", import.meta.url))]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("biblia.md");
    expect(server).toBeUndefined();
  });

  it("porta inválida dá erro claro", async () => {
    const { result } = await app(["--porta", "abc", HISTORIA]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--porta");
  });

  it("porta ocupada dá erro claro", async () => {
    const busy = createServer();
    await new Promise<void>((resolve) => busy.listen(0, "127.0.0.1", resolve));
    const port = String((busy.address() as AddressInfo).port);

    try {
      const { result, server } = await app(["--porta", port, HISTORIA]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`porta ${port} já está em uso`);
      expect(server).toBeUndefined();
    } finally {
      await new Promise((resolve) => busy.close(resolve));
    }
  });

  it("--help mostra o uso", async () => {
    const { result } = await app(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lore-pack app");
  });
});
