import { describe, expect, it } from "vitest";
import { lastScene } from "../../src/core/scene.js";

describe("lastScene", () => {
  it("devolve o texto depois do último separador ***", () => {
    const chapter = "Cena um.\n\n***\n\nCena dois.\n\n***\n\nCena três.\nFim.\n";

    expect(lastScene(chapter)).toBe("Cena três.\nFim.");
  });

  it("aceita espaços em volta do separador", () => {
    expect(lastScene("Cena um.\n  ***  \nCena dois.")).toBe("Cena dois.");
  });

  it("não confunde *** no meio de uma linha com separador", () => {
    expect(lastScene("Ele disse *** e saiu.\nMais texto.")).toBe("Ele disse *** e saiu.\nMais texto.");
  });

  it("sem separador devolve o capítulo inteiro", () => {
    expect(lastScene("\nCapítulo de uma cena só.\n")).toBe("Capítulo de uma cena só.");
  });

  it("ignora um separador no fim sem texto depois", () => {
    expect(lastScene("Cena um.\n***\nCena dois.\n***\n\n")).toBe("Cena dois.");
  });

  it("capítulo vazio devolve texto vazio", () => {
    expect(lastScene("")).toBe("");
  });
});
