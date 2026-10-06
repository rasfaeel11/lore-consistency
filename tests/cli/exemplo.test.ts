import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

// O exemplo do README. Estes testes só leem a pasta: nada é gravado nela.
const VARMONTE = fileURLToPath(new URL("../../exemplos/varmonte", import.meta.url));
const SESSION = "2026-10-06-cap-02-01";

describe("exemplos/varmonte", () => {
  it("passa no check, sem erro nem aviso", () => {
    const result = main(["check", VARMONTE], "0.0.0");

    expect(result.stdout).toBe("Tudo certo: 6 fichas validadas, 1 referência validada.\n");
    expect(result.exitCode).toBe(0);
  });

  it("tem dois capítulos e uma sessão fechada", () => {
    const { stdout } = main(["sessao", "listar", VARMONTE], "0.0.0");

    expect(stdout).toMatch(/cap-01 +A aprendiz/);
    expect(stdout).toMatch(new RegExp(`cap-02 +O degelo\\n +${SESSION} +fechada`));
  });

  it("o fechamento da sessão ainda é lido, e tudo nele já foi aplicado", () => {
    const result = main(["apply", SESSION, VARMONTE], "0.0.0");

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("[7] alfabeto.md: acrescentar 1 linha (já aplicada)");
    expect(result.stdout).toContain("Não há nenhuma operação para aplicar.");
  });

  it("não traz as instruções para a IA (o init as cria na pasta de quem usa)", () => {
    for (const name of ["CLAUDE.md", "AGENTS.md", ".claude"]) {
      expect(existsSync(join(VARMONTE, name)), name).toBe(false);
    }
  });
});
