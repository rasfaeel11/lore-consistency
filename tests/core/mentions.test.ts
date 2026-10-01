import { describe, expect, it } from "vitest";
import { findMentions } from "../../src/core/mentions.js";
import { normalize } from "../../src/core/normalize.js";

describe("normalize", () => {
  it("deixa em minúsculas e tira os acentos", () => {
    expect(normalize("Capitão JOÃO Çé")).toBe("capitao joao ce");
  });
});

// Ficha mínima: findMentions só precisa de id, nome e aliases.
function f(id: string, nome: string, aliases: string[] = []) {
  return { id, nome, aliases };
}

describe("findMentions", () => {
  it("acha o nome sem diferenciar maiúsculas nem acentos", () => {
    const result = findMentions("O CAPITAO BRUM chegou.", [f("brum", "Capitão Brum")]);

    expect(result).toEqual([{ id: "brum", matched: ["Capitão Brum"] }]);
  });

  it("acha a ficha pelo alias e diz qual alias casou", () => {
    const result = findMentions("Aninha abriu a porta.", [f("ana", "Ana Ferreira", ["Aninha"])]);

    expect(result).toEqual([{ id: "ana", matched: ["Aninha"] }]);
  });

  it("respeita limite de palavra", () => {
    const fichas = [f("al", "Al")];

    expect(findMentions("Alice e Malu saíram.", fichas)).toEqual([]);
    expect(findMentions("Al saiu. Depois, Al voltou.", fichas)).toEqual([
      { id: "al", matched: ["Al"] },
    ]);
  });

  it("acha nome de várias palavras, mesmo com quebra de linha no meio", () => {
    const result = findMentions("Seguiram para Porto\nSal ao amanhecer.", [f("porto-sal", "Porto Sal")]);

    expect(result).toEqual([{ id: "porto-sal", matched: ["Porto Sal"] }]);
  });

  it("quando um nome está contido em outro maior no mesmo trecho, vale o maior", () => {
    const fichas = [f("sal", "Sal"), f("porto-sal", "Porto Sal")];

    expect(findMentions("Chegaram a Porto Sal.", fichas)).toEqual([
      { id: "porto-sal", matched: ["Porto Sal"] },
    ]);
    // "Sal" sozinho em outro trecho continua valendo.
    expect(findMentions("Sal chegou a Porto Sal.", fichas)).toEqual([
      { id: "sal", matched: ["Sal"] },
      { id: "porto-sal", matched: ["Porto Sal"] },
    ]);
  });

  it("lista cada texto casado uma vez só, na ordem dos nomes da ficha", () => {
    const result = findMentions("Brum riu. O Velho, o capitão Brum, riu de novo. Brum.", [
      f("brum", "Capitão Brum", ["o Velho", "Brum"]),
    ]);

    expect(result).toEqual([{ id: "brum", matched: ["Capitão Brum", "o Velho", "Brum"] }]);
  });

  it("aceita nomes com caracteres especiais de regex", () => {
    const result = findMentions("Falou com o Dr. Vaz (o médico).", [f("vaz", "Dr. Vaz")]);

    expect(result).toEqual([{ id: "vaz", matched: ["Dr. Vaz"] }]);
  });
});
