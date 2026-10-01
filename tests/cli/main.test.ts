import { describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

const VERSION = "1.2.3";

describe("main", () => {
  it("--help mostra o nome da ferramenta e os comandos planejados", () => {
    const result = main(["--help"], VERSION);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lore-pack");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("check");
    expect(result.stdout).toContain("pack");
    expect(result.stdout).toContain("ui [pasta]");
  });

  it("sem argumentos mostra a ajuda", () => {
    const result = main([], VERSION);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lore-pack");
  });

  it("--version mostra a versão recebida", () => {
    const result = main(["--version"], VERSION);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("1.2.3");
  });

  it("comando desconhecido sai com código 1 e explica o erro", () => {
    const result = main(["voar"], VERSION);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("voar");
    expect(result.stderr).toContain("--help");
  });

  it("opção desconhecida sai com código 1 e explica o erro", () => {
    const result = main(["--voar"], VERSION);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--voar");
  });
});
