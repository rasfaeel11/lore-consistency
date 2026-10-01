import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

describe("init", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("cria a estrutura da história numa pasta nova", () => {
    const target = join(tempDir, "minha-historia");

    const result = main(["init", target], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(target, "biblia.md"))).toBe(true);
    expect(existsSync(join(target, "estado.md"))).toBe(true);
    expect(existsSync(join(target, "modelos", "ficha-modelo.md"))).toBe(true);
    expect(existsSync(join(target, "fichas", "personagens"))).toBe(true);
    expect(existsSync(join(target, "fichas", "personagens", ".gitkeep"))).toBe(false);
    expect(readdirSync(join(target, "sessoes"))).toEqual([]);
    expect(readdirSync(join(target, "referencias"))).toEqual([]);
    expect(existsSync(join(target, "fichas", "povos"))).toBe(true);
    expect(existsSync(join(target, "fichas", "conceitos"))).toBe(true);
    expect(existsSync(join(target, "modelos", "referencia-modelo.md"))).toBe(true);
    expect(result.stdout).toContain("check");
  });

  it("aceita uma pasta que já existe mas está vazia", () => {
    const target = join(tempDir, "vazia");
    mkdirSync(target);

    expect(main(["init", target], "0.0.0").exitCode).toBe(0);
    expect(existsSync(join(target, "biblia.md"))).toBe(true);
  });

  it("a pasta recém-criada passa no check", () => {
    const target = join(tempDir, "minha-historia");
    main(["init", target], "0.0.0");

    expect(main(["check", target], "0.0.0").exitCode).toBe(0);
  });

  it("recusa pasta com arquivos e não altera nada", () => {
    writeFileSync(join(tempDir, "meu-texto.md"), "não mexa");

    const result = main(["init", tempDir], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("não está vazia");
    expect(readdirSync(tempDir)).toEqual(["meu-texto.md"]);
  });

  it("sem pasta sai com 1 e mostra o uso", () => {
    const result = main(["init"], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("lore-pack init <pasta>");
  });
});
