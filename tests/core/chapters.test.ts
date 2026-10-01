import { describe, expect, it } from "vitest";
import { chapterForScene, listChapters, nextChapterId } from "../../src/core/chapters.js";

describe("listChapters", () => {
  it("devolve os capítulos em ordem numérica, com o título do primeiro cabeçalho #", () => {
    const chapters = listChapters([
      { path: "capitulos/cap-10.md", content: "# O fim\n\nTexto." },
      { path: "capitulos/cap-02.md", content: "Texto antes.\n\n# A chegada\n\n## Parte 1\n" },
      { path: "biblia.md", content: "# Bíblia" },
    ]);

    expect(chapters).toEqual([
      { id: "cap-02", path: "capitulos/cap-02.md", title: "A chegada" },
      { id: "cap-10", path: "capitulos/cap-10.md", title: "O fim" },
    ]);
  });

  it("sem cabeçalho #, o título é o nome do arquivo", () => {
    const [chapter] = listChapters([{ path: "capitulos/cap-01.md", content: "## Só subtítulo\nTexto." }]);

    expect(chapter?.title).toBe("cap-01");
  });

  it("ignora arquivos em subpastas de capitulos/ e o que não é .md", () => {
    const chapters = listChapters([
      { path: "capitulos/rascunhos/cap-01.md", content: "# Rascunho" },
      { path: "capitulos/notas.txt", content: "" },
    ]);

    expect(chapters).toEqual([]);
  });
});

describe("nextChapterId", () => {
  it("sem capítulos, começa em cap-01", () => {
    expect(nextChapterId([])).toBe("cap-01");
  });

  it("usa o maior número + 1, com dois dígitos", () => {
    expect(nextChapterId(["cap-01", "cap-03", "cap-02"])).toBe("cap-04");
  });

  it("passa de cap-99 para cap-100", () => {
    expect(nextChapterId(["cap-99"])).toBe("cap-100");
  });
});

describe("chapterForScene", () => {
  const files = [
    { path: "capitulos/cap-01.md", content: "# Um\n\nAna chegou ao porto." },
    { path: "capitulos/cap-02.md", content: "# Dois\n\nBrum zarpou." },
    { path: "capitulos/cap-03.md", content: "# Três\n" },
  ];

  it("sem capítulo pedido, usa o mais recente que tenha texto além do título", () => {
    expect(chapterForScene(files)).toBe("capitulos/cap-02.md");
  });

  it("com capítulo pedido e com texto, usa ele", () => {
    expect(chapterForScene(files, "cap-01")).toBe("capitulos/cap-01.md");
  });

  it("capítulo pedido só com o título cai no anterior", () => {
    expect(chapterForScene(files, "cap-03")).toBe("capitulos/cap-02.md");
  });

  it("sem nenhum capítulo com texto, devolve undefined", () => {
    expect(chapterForScene([{ path: "capitulos/cap-01.md", content: "# Um\n" }])).toBeUndefined();
  });
});
