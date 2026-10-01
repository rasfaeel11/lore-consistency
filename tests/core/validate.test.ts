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

  it("aceita os tipos povo e conceito nas pastas certas", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/povos/anoes.md", "id: anoes", "tipo: povo", "nome: Anões"),
      ficha("fichas/conceitos/o-vazio.md", "id: o-vazio", "tipo: conceito", "nome: O Vazio"),
    ]);

    expect(problems).toEqual([]);
  });

  it("povo e conceito fora da pasta certa são aviso", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/personagens/anoes.md", "id: anoes", "tipo: povo", "nome: Anões"),
      ficha("fichas/lugares/o-vazio.md", "id: o-vazio", "tipo: conceito", "nome: O Vazio"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "fichas/personagens/anoes.md", field: "tipo", severity: "aviso" }),
      expect.objectContaining({ path: "fichas/lugares/o-vazio.md", field: "tipo", severity: "aviso" }),
    ]);
    expect(problems[0]?.message).toContain("fichas/povos/");
    expect(problems[1]?.message).toContain("fichas/conceitos/");
  });
});

describe("validateStory: referências", () => {
  function referencia(id: string, ...headerLines: string[]): StoryFile {
    return { path: `referencias/${id}.md`, content: `---\n${headerLines.join("\n")}\n---\nCorpo longo.\n` };
  }

  const BRUM_COM_ESPADA: StoryFile = {
    path: "fichas/personagens/brum.md",
    content: "---\nid: brum\ntipo: personagem\nnome: Brum\n---\nLeva uma espada.\n",
  };

  it("referência válida não tem problemas", () => {
    const problems = validateStory([
      ...ROOT,
      referencia("magia", "id: magia", "nome: Magia", "palavras_chave: [Resto, feitiço]"),
      referencia("combate", "id: combate", "nome: Combate"),
    ]);

    expect(problems).toEqual([]);
  });

  it("campos obrigatórios, id fora do padrão e palavras_chave que não é lista são erros", () => {
    const problems = validateStory([
      ...ROOT,
      referencia("magia", "id: magia", "palavras_chave: Resto"),
      referencia("Politica", "id: Politica", "nome: Política"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "referencias/magia.md", field: "nome", severity: "erro" }),
      expect.objectContaining({ path: "referencias/magia.md", field: "palavras_chave", severity: "erro" }),
      expect.objectContaining({ path: "referencias/Politica.md", field: "id", severity: "erro" }),
    ]);
  });

  it("id diferente do nome do arquivo é erro", () => {
    const problems = validateStory([...ROOT, referencia("magia", "id: magias", "nome: Magia")]);

    expect(problems).toEqual([expect.objectContaining({ field: "id", severity: "erro" })]);
    expect(problems[0]?.message).toContain("magias.md");
  });

  it("id repetido entre ficha e referência é erro", () => {
    const problems = validateStory([
      ...ROOT,
      ficha("fichas/conceitos/resto.md", "id: resto", "tipo: conceito", "nome: O Resto"),
      referencia("resto", "id: resto", "nome: Resto"),
    ]);

    expect(problems).toEqual([
      expect.objectContaining({ path: "fichas/conceitos/resto.md", field: "id", severity: "erro" }),
      expect.objectContaining({ path: "referencias/resto.md", field: "id", severity: "erro" }),
    ]);
  });

  it("avisa palavra-chave que aparece em mais da metade das outras fichas e referências", () => {
    const problems = validateStory([
      ...ROOT,
      referencia("magia", "id: magia", "nome: Magia", "palavras_chave: [espada, Resto]"),
      ficha("fichas/personagens/ana.md", "id: ana", "tipo: personagem", "nome: Ana", "aparece_em: [Espada curta]"),
      BRUM_COM_ESPADA,
      ficha("fichas/lugares/porto.md", "id: porto", "tipo: lugar", "nome: Porto"),
    ]);

    // "espada" aparece em 2 de 3 outros arquivos; "Resto" em nenhum.
    expect(problems).toEqual([
      expect.objectContaining({ path: "referencias/magia.md", field: "palavras_chave", severity: "aviso" }),
    ]);
    expect(problems[0]?.message).toContain('"espada"');
    expect(problems[0]?.message).toContain("2 de 3");
  });

  it("palavra-chave em exatamente metade não é aviso", () => {
    const problems = validateStory([
      ...ROOT,
      referencia("magia", "id: magia", "nome: Magia", "palavras_chave: [espada]"),
      BRUM_COM_ESPADA,
      ficha("fichas/lugares/porto.md", "id: porto", "tipo: lugar", "nome: Porto"),
    ]);

    expect(problems).toEqual([]);
  });
});

describe("validateStory: capítulos e sessões", () => {
  const CAP = { path: "capitulos/cap-01.md", content: "# Um\n" };

  function sessao(folder: string, ...headerLines: string[]): StoryFile {
    return { path: `sessoes/${folder}/sessao.md`, content: `---\n${headerLines.join("\n")}\n---\n## Plano\n` };
  }

  const OK_HEADER = [
    "id: 2026-10-01-cap-01-01",
    "capitulo: cap-01",
    "criada_em: 2026-10-01T12:00:00.000Z",
    "status: aberta",
  ];

  it("capítulo e sessão válidos não têm problemas", () => {
    expect(validateStory([...ROOT, CAP, sessao("2026-10-01-cap-01-01", ...OK_HEADER)])).toEqual([]);
  });

  it("capítulo com nome fora do padrão cap-NN é erro", () => {
    const problems = validateStory([...ROOT, { path: "capitulos/primeiro.md", content: "# Um\n" }]);

    expect(problems).toEqual([expect.objectContaining({ path: "capitulos/primeiro.md", severity: "erro" })]);
    expect(problems[0]?.message).toContain("cap-01.md");
  });

  it("sessão sem cabeçalho é erro", () => {
    const problems = validateStory([...ROOT, CAP, { path: "sessoes/x/sessao.md", content: "sem cabeçalho" }]);

    expect(problems).toEqual([expect.objectContaining({ path: "sessoes/x/sessao.md", severity: "erro" })]);
  });

  it("status inválido é erro no campo status", () => {
    const header = OK_HEADER.map((l) => (l.startsWith("status") ? "status: pausada" : l));
    const problems = validateStory([...ROOT, CAP, sessao("2026-10-01-cap-01-01", ...header)]);

    expect(problems).toEqual([expect.objectContaining({ field: "status", severity: "erro" })]);
  });

  it("id diferente do nome da pasta é erro", () => {
    const problems = validateStory([...ROOT, CAP, sessao("outra-pasta", ...OK_HEADER)]);

    expect(problems).toEqual([expect.objectContaining({ field: "id", severity: "erro" })]);
  });

  it("capítulo que não existe em capitulos/ é erro", () => {
    const problems = validateStory([...ROOT, sessao("2026-10-01-cap-01-01", ...OK_HEADER)]);

    expect(problems).toEqual([expect.objectContaining({ field: "capitulo", severity: "erro" })]);
    expect(problems[0]?.message).toContain("capitulos/cap-01.md");
  });
});
