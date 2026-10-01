import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

describe("capitulo novo", () => {
  let tempDir: string;
  let story: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
    cpSync(HISTORIA, story, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("cria o próximo cap-NN.md com o título como cabeçalho", () => {
    const result = main(["capitulo", "novo", "A tempestade", story], "0.0.0");

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(story, "capitulos", "cap-03.md"), "utf8")).toBe("# A tempestade\n");
    expect(result.stdout).toContain("capitulos/cap-03.md");
  });

  it("sem capitulos/, cria a pasta e o cap-01", () => {
    rmSync(join(story, "capitulos"), { recursive: true });
    rmSync(join(story, "sessoes"), { recursive: true });

    expect(main(["capitulo", "novo", "Início", story], "0.0.0").exitCode).toBe(0);
    expect(existsSync(join(story, "capitulos", "cap-01.md"))).toBe(true);
  });

  it("sem título sai com 1", () => {
    const result = main(["capitulo", "novo"], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("título");
  });

  it("pasta que não é de história sai com 1", () => {
    const result = main(["capitulo", "novo", "X", tempDir], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("biblia.md");
  });
});
