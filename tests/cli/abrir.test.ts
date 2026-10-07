import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { abrir } from "../../src/cli/abrir.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

describe("abrir", () => {
  it("abre a pasta da história e mostra o caminho", () => {
    const opened: string[] = [];

    const result = abrir([HISTORIA], (folder) => opened.push(folder));

    expect(opened).toEqual([resolve(HISTORIA)]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(resolve(HISTORIA));
  });

  it("pasta que não é de história: erro, e nada é aberto", () => {
    const opened: string[] = [];

    const result = abrir([resolve(HISTORIA, "sessoes")], (folder) => opened.push(folder));

    expect(opened).toEqual([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("não tem biblia.md");
  });

  it("--help mostra o uso sem abrir nada", () => {
    const opened: string[] = [];

    const result = abrir(["--help"], (folder) => opened.push(folder));

    expect(opened).toEqual([]);
    expect(result.stdout).toContain("lore-pack abrir [pasta]");
  });
});
