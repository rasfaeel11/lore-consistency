import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/check/${name}`, import.meta.url));
}

describe("check", () => {
  it("pasta válida sai com 0 e diz quantas fichas foram validadas", () => {
    const result = main(["check", fixture("valida")], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("4 fichas validadas");
  });

  it("aceita os tipos povo e conceito", () => {
    const result = main(["check", fixture("valida-tipos-novos")], "0.0.0");

    expect(result.stdout).toBe("Tudo certo: 2 fichas validadas.\n");
    expect(result.exitCode).toBe(0);
  });

  it("conta as referências validadas", () => {
    const historia = fileURLToPath(new URL("../fixtures/pack/referencias", import.meta.url));
    const result = main(["check", historia], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Tudo certo: 1 ficha validada, 5 referências validadas.\n");
  });

  it("povo e conceito na pasta errada são avisados com a pasta certa", () => {
    const result = main(["check", fixture("aviso-pasta-errada-povo-conceito")], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("fichas/povos/");
    expect(result.stdout).toContain("fichas/conceitos/");
  });

  // [fixture, arquivo esperado na saída, campo esperado na saída (ou null)]
  it.each([
    ["erro-sem-frontmatter", "fichas/personagens/ana-ferreira.md", null],
    ["erro-frontmatter-mal-fechado", "fichas/personagens/ana-ferreira.md", null],
    ["erro-yaml-invalido", "fichas/personagens/ana-ferreira.md", null],
    ["erro-campo-ausente", "fichas/personagens/ana-ferreira.md", "nome"],
    ["erro-tipo-invalido", "fichas/personagens/ana-ferreira.md", "tipo"],
    ["erro-id-diferente-do-arquivo", "fichas/personagens/ana.md", "id"],
    ["erro-id-fora-do-padrao", "fichas/personagens/Ana_Ferreira.md", "id"],
    ["erro-id-duplicado", "fichas/lugares/brum.md", "id"],
    ["erro-sem-biblia", "biblia.md", null],
    ["erro-sem-estado", "estado.md", null],
    ["erro-sessao-invalida", "sessoes/2026-10-01-cap-01-01/sessao.md", "status"],
    ["erro-referencia-invalida", "referencias/magia.md", "nome"],
  ])("%s sai com 1 e aponta o arquivo e o campo", (name, path, field) => {
    const result = main(["check", fixture(name)], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(path);
    expect(result.stdout).toContain("erro");
    if (field) expect(result.stdout).toContain(`[${field}]`);
  });

  it.each([
    ["aviso-nome-repetido", "fichas/personagens/lia-moraes.md", "aliases"],
    ["aviso-pasta-errada", "fichas/personagens/porto-velho.md", "tipo"],
    ["aviso-pasta-errada-povo-conceito", "fichas/personagens/anoes.md", "tipo"],
    ["aviso-palavra-chave-generica", "referencias/combate.md", "palavras_chave"],
  ])("%s sai com 0 mas mostra o aviso", (name, path, field) => {
    const result = main(["check", fixture(name)], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(path);
    expect(result.stdout).toContain("aviso");
    expect(result.stdout).toContain(`[${field}]`);
  });

  it("pasta que não existe sai com 1 e explica", () => {
    const result = main(["check", fixture("nao-existe")], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("não existe");
  });
});
