import { describe, expect, it } from "vitest";
import { selectFichas } from "../../src/core/select.js";

const fichas = [
  { id: "ana", nome: "Ana Ferreira", aliases: ["Aninha"] },
  { id: "brum", nome: "Capitão Brum", aliases: [] },
  { id: "guilda", nome: "Guilda do Sal", aliases: [] },
];

// Atalho para olhar só id, motivos e textos casados.
function summary(result: ReturnType<typeof selectFichas>) {
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.selected.map((s) => ({ id: s.id, reasons: s.reasons, matched: s.matched }));
}

describe("selectFichas", () => {
  it("junta as fichas do plano e da última cena, com os motivos certos", () => {
    const result = selectFichas({
      fichas,
      plan: "Aninha encontra o capitão Brum.",
      lastScene: "Ana Ferreira olhou o mar.",
      include: [],
      exclude: [],
    });

    expect(summary(result)).toEqual([
      { id: "ana", reasons: ["plano", "última cena"], matched: ["Aninha", "Ana Ferreira"] },
      { id: "brum", reasons: ["plano"], matched: ["Capitão Brum"] },
    ]);
  });

  it("--com força uma ficha que não foi citada", () => {
    const result = selectFichas({
      fichas,
      plan: "Aninha sozinha.",
      lastScene: "",
      include: ["guilda"],
      exclude: [],
    });

    expect(summary(result)).toEqual([
      { id: "ana", reasons: ["plano"], matched: ["Aninha"] },
      { id: "guilda", reasons: ["forçada"], matched: [] },
    ]);
  });

  it("--sem tira uma ficha mesmo que ela tenha sido citada ou forçada", () => {
    const result = selectFichas({
      fichas,
      plan: "Aninha e Brum.",
      lastScene: "",
      include: ["brum"],
      exclude: ["brum"],
    });

    expect(summary(result).map((s) => s.id)).toEqual(["ana"]);
  });

  it("id inexistente em --com ou --sem vira erro claro", () => {
    const result = selectFichas({
      fichas,
      plan: "",
      lastScene: "",
      include: ["anna"],
      exclude: ["bruno"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain("--com");
      expect(result.errors[0]).toContain('"anna"');
      expect(result.errors[1]).toContain("--sem");
      expect(result.errors[1]).toContain('"bruno"');
    }
  });

  it("nada citado e nada forçado devolve lista vazia", () => {
    const result = selectFichas({ fichas, plan: "Chove.", lastScene: "", include: [], exclude: [] });

    expect(summary(result)).toEqual([]);
  });
});
