import { describe, expect, it } from "vitest";
import { fichaSchema } from "../../src/core/ficha.js";

// Devolve as mensagens de erro por campo, para os testes ficarem legíveis.
function errorsFor(data: unknown): Record<string, string> {
  const result = fichaSchema.safeParse(data);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe("fichaSchema", () => {
  it("aceita uma ficha mínima e preenche listas vazias", () => {
    const result = fichaSchema.parse({ id: "ana", tipo: "personagem", nome: "Ana" });

    expect(result).toEqual({
      id: "ana",
      tipo: "personagem",
      nome: "Ana",
      aliases: [],
      relacionados: [],
      aparece_em: [],
    });
  });

  it("aceita relacionados e deixa passar campos próprios da história", () => {
    const result = fichaSchema.safeParse({
      id: "ana",
      tipo: "personagem",
      nome: "Ana",
      relacionados: ["porto-sal"],
      nome_antigo: "Anael",
    });

    expect(result.success).toBe(true);
    expect(result.data?.relacionados).toEqual(["porto-sal"]);
  });

  it("aceita campos opcionais vazios, como vêm do modelo de ficha", () => {
    // No YAML, "status:" sem valor vira null.
    const result = fichaSchema.parse({
      id: "ana",
      tipo: "personagem",
      nome: "Ana",
      aliases: null,
      status: null,
      aparece_em: null,
    });

    expect(result.aliases).toEqual([]);
    expect(result.aparece_em).toEqual([]);
    expect(result.status).toBeUndefined();
  });

  it("aceita ids com números", () => {
    expect(errorsFor({ id: "guarda-02", tipo: "personagem", nome: "Guarda" })).toEqual({});
  });

  it("campo obrigatório ausente diz qual campo e como consertar", () => {
    const errors = errorsFor({ id: "ana", tipo: "personagem" });

    expect(errors.nome).toContain("ausente");
    expect(errors.nome).toContain("nome:");
  });

  it("nome vazio é erro", () => {
    expect(errorsFor({ id: "ana", tipo: "personagem", nome: null }).nome).toContain("vazio");
    expect(errorsFor({ id: "ana", tipo: "personagem", nome: "  " }).nome).toContain("vazio");
  });

  it("tipo fora da lista mostra os valores aceitos", () => {
    const errors = errorsFor({ id: "ana", tipo: "pessoa", nome: "Ana" });

    expect(errors.tipo).toContain("pessoa");
    expect(errors.tipo).toContain("personagem, lugar, faccao, objeto");
  });

  it("id fora do padrão minúsculas-e-hífen é erro", () => {
    expect(errorsFor({ id: "Ana_Ferreira", tipo: "personagem", nome: "Ana" }).id).toContain(
      "minúsculas",
    );
    expect(errorsFor({ id: "joão", tipo: "personagem", nome: "João" }).id).toBeDefined();
    expect(errorsFor({ id: "ana-", tipo: "personagem", nome: "Ana" }).id).toBeDefined();
  });

  it("aliases que não é lista de textos é erro", () => {
    expect(
      errorsFor({ id: "ana", tipo: "personagem", nome: "Ana", aliases: "Aninha" }).aliases,
    ).toContain("lista");
  });
});
