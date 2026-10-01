import { describe, expect, it } from "vitest";
import { validateStory, type StoryFile } from "../../src/core/validate.js";

// Arquivos obrigatórios da raiz, para os testes focarem nas fichas.
const ROOT: StoryFile[] = [
  { path: "biblia.md", content: "# Bíblia\n" },
  { path: "estado.md", content: "# Estado\n" },
];

// Monta o conteúdo de uma ficha a partir das linhas do cabeçalho.
function ficha(path: string, ...headerLines: string[]): StoryFile {
  return { path, content: `---\n${headerLines.join("\n")}\n---\nCorpo.\n` };
}

describe("validateStory", () => {
  it("pasta válida não tem problemas", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: ana", "tipo: personagem", "nome: Ana", "aliases: [Aninha]"),
      ficha("fichas/lugares/porto.md", "id: porto", "tipo: lugar", "nome: Porto Velho"),
    ]);

    expect(problems).toEqual([]);
  });

  it("ignora arquivos fora de fichas/ e arquivos que não são .md", () => {
    const problems = validateStory([
      ...ROOT,
      { path: "COMO-USAR.md", content: "sem cabeçalho" },
      { path: "modelos/ficha-modelo.md", content: "---\nid: nome-em-minusculas\n---\n" },
      { path: "fichas/personagens/.gitkeep", content: "" },
    ]);

    expect(problems).toEqual([]);
  });

  it("biblia.md e estado.md ausentes são erros", () => {
    const problems = validateStory([]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "biblia.md", field: null, severity: "erro" }),
      expect.objectContaining({ path: "estado.md", field: null, severity: "erro" }),
    ]);
  });

  it("frontmatter inválido é erro sem campo", () => {
    const problems = validateStory([
      ...ROOT,
      { path: "fichas/personagens/ana.md", content: "# Ana\n" },
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "fichas/personagens/ana.md", field: null, severity: "erro" }),
    ]);
  });

  it("campo obrigatório ausente e tipo fora da lista são erros no campo certo", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: ana", "tipo: pessoa"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ field: "tipo", severity: "erro" }),
      expect.objectContaining({ field: "nome", severity: "erro" }),
    ]);
  });

  it("id fora do padrão é erro", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/Ana.md", "id: Ana", "tipo: personagem", "nome: Ana"),
    ]);

    expect(problems).toEqual([expect.objectContaining({ field: "id", severity: "erro" })]);
  });

  it("id diferente do nome do arquivo é erro e sugere o conserto", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: ana-ferreira", "tipo: personagem", "nome: Ana"),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ field: "id", severity: "erro" });
    expect(problems[0]?.message).toContain("ana-ferreira.md");
  });

  it("mostra id diferente do arquivo junto com os outros erros da ficha", () => {
    // Caso típico: copiou o modelo e esqueceu de preencher.
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: nome-em-minusculas-com-hifen", "tipo: personagem", "nome:"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ field: "nome", severity: "erro" }),
      expect.objectContaining({ field: "id", severity: "erro" }),
    ]);
  });

  it("id duplicado é erro nos dois arquivos", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/brum.md", "id: brum", "tipo: personagem", "nome: Capitão Brum"),
      ficha("fichas/lugares/brum.md", "id: brum", "tipo: lugar", "nome: Forte Brum"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "fichas/personagens/brum.md", field: "id", severity: "erro" }),
      expect.objectContaining({ path: "fichas/lugares/brum.md", field: "id", severity: "erro" }),
    ]);
  });

  it("mesmo nome ou alias em fichas diferentes é aviso, sem diferenciar maiúsculas nem acentos", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: ana", "tipo: personagem", "nome: Ana", "aliases: [A Capitã]"),
      ficha("fichas/personagens/lia.md", "id: lia", "tipo: personagem", "nome: Lia", "aliases: [a capita]"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "fichas/personagens/ana.md", field: "aliases", severity: "aviso" }),
      expect.objectContaining({ path: "fichas/personagens/lia.md", field: "aliases", severity: "aviso" }),
    ]);
    expect(problems[0]?.message).toContain("fichas/personagens/lia.md");
  });

  it("nome repetido dentro da mesma ficha não é aviso", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/ana.md", "id: ana", "tipo: personagem", "nome: Ana", "aliases: [ana]"),
    ]);

    expect(problems).toEqual([]);
  });

  it("ficha numa pasta que não bate com o tipo é aviso", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/porto.md", "id: porto", "tipo: lugar", "nome: Porto"),
    ]);

    expect(problems).toEqual([expect.objectContaining({ field: "tipo", severity: "aviso" })]);
    expect(problems[0]?.message).toContain("fichas/lugares/");
  });
});
