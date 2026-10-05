import { describe, expect, it } from "vitest";
import {
  applyChanges,
  buildFixPrompt,
  describeOperation,
  extractChanges,
  isAllowedTarget,
  previewChanges,
  type Operation,
} from "../../src/core/changes.js";
import type { StoryFile } from "../../src/core/validate.js";

function block(json: string): string {
  return `Texto para o autor ler.\n\n\`\`\`lore-pack-mudancas\n${json}\n\`\`\`\n`;
}

function operations(...list: string[]): string {
  return block(`{ "operacoes": [ ${list.join(",\n")} ] }`);
}

const ESTADO = `# Estado da história

## Resumo geral (máximo 1 página)
Ana chegou a Porto Sal.

## Capítulos (3 a 5 linhas cada)
<!-- cap-01: ... -->

## Setups abertos
- o mapa rasgado | cap-01 | rota do farol

## Pendências e dúvidas
`;

const ANA = `---
id: ana-ferreira
tipo: personagem
nome: Ana Ferreira
status: viva
---
**Essencial (1 linha):** cartógrafa.

**Fatos** (telegráfico, com capítulo de origem):
- Chegou de barco (cap-01).

**Relações:**
-

**Segredos (o leitor ainda não sabe):**
- É filha do capitão.
`;

const ALFABETO = `# Alfabeto

## Nomes já usados
- Ana Ferreira | cartógrafa | costeiros | cap-01

## Nomes reservados (criados, ainda não usados)
`;

const TOBIAS = "---\nid: tobias-vau\ntipo: personagem\nnome: Tobias Vau\n---\n**Essencial (1 linha):** faroleiro.\n";

const FILES: StoryFile[] = [
  { path: "alfabeto.md", content: ALFABETO },
  { path: "biblia.md", content: "# Bíblia\n" },
  { path: "estado.md", content: ESTADO },
  { path: "fichas/personagens/ana-ferreira.md", content: ANA },
  { path: "referencias/magia.md", content: "---\nid: magia\nnome: Magia\n---\nTexto.\n" },
];

// Aplica uma operação só e devolve o conteúdo novo do arquivo que ela mudou.
function applied(operation: Operation, files: StoryFile[] = FILES): string {
  const result = applyChanges([operation], files);
  if (!result.ok) throw new Error(result.error);
  expect(result.changed).toHaveLength(1);
  return result.changed[0]?.content ?? "";
}

function failure(operation: Operation, files: StoryFile[] = FILES): string {
  const result = applyChanges([operation], files);
  if (result.ok) throw new Error("esperava um erro");
  return result.error;
}

function extractError(text: string): string {
  const result = extractChanges(text);
  if (result.ok) throw new Error("esperava um erro");
  return result.error;
}

describe("extractChanges", () => {
  it("acha o bloco e valida as operações", () => {
    const result = extractChanges(
      operations(
        '{ "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["cap-01: Ana chega."] }',
        '{ "op": "ficha_substituir", "id": "ana-ferreira", "antigo": "status: viva", "novo": "status: ferida" }',
        '{ "op": "nao_aprovado", "itens": ["O farol ser assombrado."] }',
      ),
    );

    expect(result).toEqual({
      ok: true,
      operations: [
        { op: "estado_adicionar", secao: "Capítulos", linhas: ["cap-01: Ana chega."] },
        { op: "ficha_substituir", id: "ana-ferreira", antigo: "status: viva", novo: "status: ferida" },
        { op: "nao_aprovado", itens: ["O farol ser assombrado."] },
      ],
    });
  });

  it("aceita quebras de linha do Windows e lista vazia", () => {
    expect(extractChanges('Nada mudou.\r\n\r\n```lore-pack-mudancas\r\n{ "operacoes": [] }\r\n```\r\n')).toEqual({
      ok: true,
      operations: [],
    });
  });

  it("com dois blocos, vale o último (a IA pode citar um exemplo antes)", () => {
    const text =
      operations('{ "op": "alfabeto_adicionar", "linhas": ["exemplo"] }') +
      operations('{ "op": "alfabeto_adicionar", "linhas": ["de verdade"] }');

    expect(extractChanges(text)).toEqual({ ok: true, operations: [{ op: "alfabeto_adicionar", linhas: ["de verdade"] }] });
  });

  it("bloco ausente: avisa que a pasta pode ter o prompt 04 antigo", () => {
    const message = extractError("Só texto, sem bloco.\n\n```json\n[]\n```\n");

    expect(message).toContain("Não achei o bloco");
    expect(message).toContain("04-fechar-sessao.md");
    expect(message).toContain("lore-pack init");
  });

  it("bloco sem as crases de fechamento (resposta cortada)", () => {
    expect(extractError('```lore-pack-mudancas\n{ "operacoes": [')).toContain("crases de fechamento");
  });

  it("JSON inválido", () => {
    expect(extractError(block('{ "operacoes": [ { "op": "alfabeto_adicionar", "linhas": ["a"], } ] }'))).toContain("não é um JSON válido");
  });

  it("JSON sem a lista operacoes", () => {
    expect(extractError(block('[ { "op": "alfabeto_adicionar", "linhas": ["a"] } ]'))).toContain('"operacoes"');
  });

  it("operação desconhecida diz qual e quais existem", () => {
    const message = extractError(operations('{ "op": "ficha_apagar", "id": "ana-ferreira" }'));

    expect(message).toContain("Operação 1");
    expect(message).toContain('"ficha_apagar"');
    expect(message).toContain("ficha_substituir");
  });

  it("campo ausente, campo desconhecido, linha com quebra e trecho vazio viram erros com o número da operação", () => {
    const message = extractError(
      operations(
        '{ "op": "estado_adicionar", "linhas": ["a"] }',
        '{ "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["a"], "arquivo": "biblia.md" }',
        '{ "op": "alfabeto_adicionar", "linhas": ["um\\ndois"] }',
        '{ "op": "estado_substituir", "antigo": "", "novo": "x" }',
        '{ "op": "ficha_substituir", "id": "ana-ferreira", "novo": "x" }',
      ),
    );

    expect(message).toContain('Operação 1 (estado_adicionar): Falta o campo "secao"');
    expect(message).toContain('Operação 2 (estado_adicionar): Campo desconhecido: "arquivo"');
    expect(message).toContain("Operação 3 (alfabeto_adicionar)");
    expect(message).toContain('Operação 4 (estado_substituir): "antigo" está vazio');
    expect(message).toContain('Operação 5 (ficha_substituir): Falta o campo "antigo"');
  });

  it("recusa id com ../ ou maiúscula e tipo que não existe", () => {
    const outside = extractError(operations('{ "op": "ficha_adicionar", "id": "../../biblia", "secao": "Fatos", "linhas": ["x"] }'));
    const upper = extractError(operations('{ "op": "ficha_substituir", "id": "Ana", "antigo": "a", "novo": "b" }'));
    const folder = extractError(operations('{ "op": "ficha_criar", "tipo": "../x", "id": "x", "conteudo": "y" }'));

    expect(outside).toContain('O id "../../biblia" é inválido');
    expect(upper).toContain('O id "Ana" é inválido');
    expect(folder).toContain('O tipo "../x" não existe');
  });
});

describe("buildFixPrompt", () => {
  it("monta um texto para colar na IA com o erro e o pedido de reenviar só o bloco", () => {
    const text = buildFixPrompt("Operação 1: operação desconhecida.");

    expect(text).toContain("Operação 1: operação desconhecida.");
    expect(text).toContain("lore-pack-mudancas");
    expect(text).toMatch(/só o bloco/i);
  });
});

describe("applyChanges: uma operação", () => {
  describe("estado_adicionar", () => {
    it("acrescenta no fim da seção, achada pelo título sem o texto entre parênteses", () => {
      const result = applied({ op: "estado_adicionar", secao: "capitulos", linhas: ["cap-01: Ana chega.", "cap-02: O cais."] });

      expect(result).toContain("<!-- cap-01: ... -->\ncap-01: Ana chega.\ncap-02: O cais.\n\n## Setups abertos");
    });

    it("aceita o título com ## e funciona na última seção, mesmo vazia", () => {
      const result = applied({ op: "estado_adicionar", secao: "## Pendências e dúvidas", linhas: ["- Quem apagou a lanterna?"] });

      expect(result.endsWith("## Pendências e dúvidas\n- Quem apagou a lanterna?\n")).toBe(true);
    });

    it("seção inexistente lista as que existem", () => {
      const message = failure({ op: "estado_adicionar", secao: "Personagens", linhas: ["x"] });

      expect(message).toContain('A seção "Personagens" não existe');
      expect(message).toContain("Setups abertos");
    });

    it("seção que aparece duas vezes é ambígua", () => {
      const files = FILES.map((file) => (file.path === "estado.md" ? { ...file, content: `${ESTADO}\n## Setups abertos\n` } : file));

      expect(failure({ op: "estado_adicionar", secao: "Setups abertos", linhas: ["x"] }, files)).toContain("aparece 2 vezes");
    });

    it("recusa quando as linhas já estão na seção", () => {
      const message = failure({ op: "estado_adicionar", secao: "Setups abertos", linhas: ["- o mapa rasgado | cap-01 | rota do farol"] });

      expect(message).toContain("já estão");
    });

    it("sem o arquivo, erro", () => {
      const files = FILES.filter((file) => file.path !== "estado.md");

      expect(failure({ op: "estado_adicionar", secao: "Capítulos", linhas: ["x"] }, files)).toContain("estado.md não existe");
    });
  });

  describe("estado_substituir", () => {
    it("troca a frase do resumo geral", () => {
      const result = applied({ op: "estado_substituir", antigo: "Ana chegou a Porto Sal.", novo: "Ana chegou a Porto Sal e subiu ao farol." });

      expect(result).toContain("## Resumo geral (máximo 1 página)\nAna chegou a Porto Sal e subiu ao farol.\n");
    });

    it("trecho ausente e trecho repetido", () => {
      expect(failure({ op: "estado_substituir", antigo: "Ana fugiu.", novo: "x" })).toContain("não aparece no estado.md");
      expect(failure({ op: "estado_substituir", antigo: "## ", novo: "### " })).toMatch(/aparece \d+ vezes no estado\.md/);
    });
  });

  describe("ficha_adicionar", () => {
    it("acrescenta no fim da seção em negrito, antes da próxima", () => {
      const result = applied({ op: "ficha_adicionar", id: "ana-ferreira", secao: "**Fatos**", linhas: ["- Conheceu Tobias (cap-01)."] });

      expect(result).toContain("- Chegou de barco (cap-01).\n- Conheceu Tobias (cap-01).\n\n**Relações:**");
    });

    it("troca o marcador vazio do modelo em vez de deixar um '-' solto", () => {
      const result = applied({ op: "ficha_adicionar", id: "ana-ferreira", secao: "Relações", linhas: ["- Tobias: desconfia dela."] });

      expect(result).toContain("**Relações:**\n- Tobias: desconfia dela.\n\n**Segredos");
    });

    it("acha a seção sem acento e sem os parênteses", () => {
      const result = applied({ op: "ficha_adicionar", id: "ana-ferreira", secao: "segredos", linhas: ["- Roubou o mapa."] });

      expect(result.endsWith("- É filha do capitão.\n- Roubou o mapa.\n")).toBe(true);
    });

    it("procura só no corpo: um comentário do cabeçalho YAML não é seção", () => {
      const files = FILES.map((file) =>
        file.path.endsWith("ana-ferreira.md") ? { ...file, content: ANA.replace("status: viva\n", "status: viva\n# Fatos\n") } : file,
      );

      const result = applied({ op: "ficha_adicionar", id: "ana-ferreira", secao: "Fatos", linhas: ["- Novo."] }, files);

      expect(result).toContain("- Chegou de barco (cap-01).\n- Novo.\n");
    });

    it("seção inexistente, ficha inexistente e id de referência", () => {
      expect(failure({ op: "ficha_adicionar", id: "ana-ferreira", secao: "Voz", linhas: ["x"] })).toContain('A seção "Voz" não existe');
      expect(failure({ op: "ficha_adicionar", id: "tobias-vau", secao: "Fatos", linhas: ["x"] })).toContain('A ficha "tobias-vau" não existe');
      expect(failure({ op: "ficha_adicionar", id: "magia", secao: "Fatos", linhas: ["x"] })).toContain("não altera referências");
    });
  });

  describe("ficha_substituir", () => {
    it("troca o trecho que aparece uma vez, inclusive no cabeçalho", () => {
      const result = applied({ op: "ficha_substituir", id: "ana-ferreira", antigo: "status: viva", novo: "status: ferida" });

      expect(result).toContain("status: ferida\n---");
      expect(result).not.toContain("status: viva");
    });

    it("o texto novo entra como está, mesmo com $", () => {
      const result = applied({ op: "ficha_substituir", id: "ana-ferreira", antigo: "cartógrafa", novo: "deve $& e $1" });

      expect(result).toContain("**Essencial (1 linha):** deve $& e $1.");
    });

    it("trecho não encontrado e trecho repetido", () => {
      expect(failure({ op: "ficha_substituir", id: "ana-ferreira", antigo: "status: morta", novo: "x" })).toContain("não aparece na ficha");
      expect(failure({ op: "ficha_substituir", id: "ana-ferreira", antigo: "- ", novo: "* " })).toMatch(/aparece \d+ vezes na ficha/);
    });
  });

  describe("ficha_criar", () => {
    const create: Operation = { op: "ficha_criar", tipo: "personagem", id: "tobias-vau", conteudo: TOBIAS };

    it("cria a ficha na pasta do tipo", () => {
      const result = applyChanges([create], FILES);

      expect(result).toEqual({ ok: true, changed: [{ path: "fichas/personagens/tobias-vau.md", content: TOBIAS }] });
    });

    it("falha se o id já é de uma ficha ou de uma referência", () => {
      expect(failure({ ...create, id: "ana-ferreira", conteudo: ANA })).toContain("já existe");
      expect(failure({ op: "ficha_criar", tipo: "conceito", id: "magia", conteudo: "x" })).toContain("referencias/magia.md");
    });

    it("falha se o conteúdo não tem cabeçalho válido", () => {
      expect(failure({ ...create, conteudo: "Só texto." })).toContain("cabeçalho");
      expect(failure({ ...create, conteudo: "---\nid: tobias-vau\ntipo: personagem\n---\n" })).toContain('"nome"');
    });

    it("falha se o id ou o tipo do conteúdo forem diferentes dos da operação (ficha na pasta errada)", () => {
      expect(failure({ ...create, id: "tobias" })).toContain('id "tobias-vau"');
      expect(failure({ ...create, tipo: "lugar" })).toContain('tipo "personagem"');
    });
  });

  describe("alfabeto_adicionar", () => {
    it("acrescenta em 'Nomes já usados'", () => {
      const result = applied({ op: "alfabeto_adicionar", linhas: ["- Tobias Vau | faroleiro | costeiros | cap-01"] });

      expect(result).toContain("| cap-01\n- Tobias Vau | faroleiro | costeiros | cap-01\n\n## Nomes reservados");
    });

    it("com secao, acrescenta nela", () => {
      const result = applied({ op: "alfabeto_adicionar", secao: "Nomes reservados", linhas: ["- Irsa"] });

      expect(result.endsWith("## Nomes reservados (criados, ainda não usados)\n- Irsa\n")).toBe(true);
    });

    it("sem a seção do modelo, diz quais existem", () => {
      const files = FILES.map((file) => (file.path === "alfabeto.md" ? { ...file, content: "# Nomes\n\n## Lista\n- Ana\n" } : file));

      const message = failure({ op: "alfabeto_adicionar", linhas: ["- Tobias"] }, files);

      expect(message).toContain('A seção "Nomes já usados" não existe');
      expect(message).toContain('"Lista"');
    });
  });
});

describe("isAllowedTarget", () => {
  it("só estado.md, alfabeto.md e fichas/ podem ser tocados", () => {
    expect(isAllowedTarget("estado.md")).toBe(true);
    expect(isAllowedTarget("alfabeto.md")).toBe(true);
    expect(isAllowedTarget("fichas/lugares/farol.md")).toBe(true);
    expect(isAllowedTarget("biblia.md")).toBe(false);
    expect(isAllowedTarget("capitulos/cap-01.md")).toBe(false);
    expect(isAllowedTarget("referencias/magia.md")).toBe(false);
    expect(isAllowedTarget("fichas/../biblia.md")).toBe(false);
    expect(isAllowedTarget("fichas/lugares/farol.txt")).toBe(false);
  });
});

describe("previewChanges", () => {
  const list: Operation[] = [
    { op: "ficha_criar", tipo: "personagem", id: "tobias-vau", conteudo: TOBIAS },
    { op: "ficha_adicionar", id: "tobias-vau", secao: "Essencial", linhas: ["- Manco da perna esquerda."] },
    { op: "ficha_adicionar", id: "ninguem", secao: "Fatos", linhas: ["x"] },
    { op: "estado_adicionar", secao: "Setups abertos", linhas: ["- a lanterna apagada | cap-01 | ?"] },
    { op: "nao_aprovado", itens: ["O farol ser assombrado.", "Ana ser canhota."] },
  ];

  it("dá o diff de cada operação, em sequência, sem mudar os arquivos recebidos", () => {
    const before = JSON.stringify(FILES);

    const items = previewChanges(list, FILES);

    expect(JSON.stringify(FILES)).toBe(before);
    expect(items.map((item) => [item.index, item.op, item.path, item.kind])).toEqual([
      [1, "ficha_criar", "fichas/personagens/tobias-vau.md", "criado"],
      [2, "ficha_adicionar", "fichas/personagens/tobias-vau.md", "alterado"],
      [3, "ficha_adicionar", null, "alterado"],
      [4, "estado_adicionar", "estado.md", "alterado"],
      [5, "nao_aprovado", null, "informativo"],
    ]);
    expect(items[0]?.diff).toContain("+ nome: Tobias Vau");
    // A segunda operação já enxerga a ficha criada pela primeira.
    expect(items[1]?.error).toBeUndefined();
    expect(items[1]?.diff).toContain("+ - Manco da perna esquerda.");
    expect(items[2]?.error).toContain('A ficha "ninguem" não existe');
    expect(items[3]?.diff).toBe(
      "…\n  ## Setups abertos\n  - o mapa rasgado | cap-01 | rota do farol\n+ - a lanterna apagada | cap-01 | ?\n  \n  ## Pendências e dúvidas",
    );
    expect(items[4]?.diff).toBe("- O farol ser assombrado.\n- Ana ser canhota.");
  });
});

describe("applyChanges: várias operações", () => {
  it("aplica em sequência e devolve só os arquivos que mudaram", () => {
    const result = applyChanges(
      [
        { op: "ficha_criar", tipo: "personagem", id: "tobias-vau", conteudo: TOBIAS },
        { op: "ficha_adicionar", id: "tobias-vau", secao: "Essencial", linhas: ["- Manco."] },
        { op: "estado_adicionar", secao: "Capítulos", linhas: ["cap-01: Ana chega."] },
        { op: "nao_aprovado", itens: ["nada"] },
      ],
      FILES,
    );

    if (!result.ok) throw new Error(result.error);
    expect(result.changed.map((file) => file.path)).toEqual(["estado.md", "fichas/personagens/tobias-vau.md"]);
    expect(result.changed[1]?.content).toContain("- Manco.");
  });

  it("se uma falha, nada é devolvido, e o erro diz qual", () => {
    const result = applyChanges(
      [
        { op: "estado_adicionar", secao: "Capítulos", linhas: ["cap-01: Ana chega."] },
        { op: "estado_adicionar", secao: "Personagens", linhas: ["x"] },
      ],
      FILES,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('estado.md: acrescentar 1 linha em "Personagens"');
  });

  it("erro novo na validação cancela tudo, com a mensagem do check", () => {
    // Trocar o id no cabeçalho deixa a ficha com id diferente do nome do arquivo.
    const message = failure({ op: "ficha_substituir", id: "ana-ferreira", antigo: "id: ana-ferreira", novo: "id: ana" });

    expect(message).toContain("fichas/personagens/ana-ferreira.md");
    expect(message).toContain('O id "ana" é diferente do nome do arquivo');
  });

  it("erro que já existia antes não impede", () => {
    const files = [...FILES, { path: "fichas/lugares/quebrada.md", content: "sem cabeçalho" }];

    expect(applyChanges([{ op: "estado_adicionar", secao: "Capítulos", linhas: ["cap-01: Ana chega."] }], files).ok).toBe(true);
  });
});

describe("describeOperation", () => {
  it("resume cada operação numa linha", () => {
    expect(describeOperation({ op: "estado_adicionar", secao: "Capítulos", linhas: ["a", "b"] })).toBe(
      'estado.md: acrescentar 2 linhas em "Capítulos"',
    );
    expect(describeOperation({ op: "estado_substituir", antigo: "a", novo: "b" })).toBe("estado.md: trocar um trecho");
    expect(describeOperation({ op: "ficha_criar", tipo: "lugar", id: "farol", conteudo: "x" })).toBe("criar a ficha farol (lugar)");
    expect(describeOperation({ op: "ficha_adicionar", id: "ana-ferreira", secao: "Fatos", linhas: ["a"] })).toBe(
      'ficha ana-ferreira: acrescentar 1 linha em "Fatos"',
    );
    expect(describeOperation({ op: "ficha_substituir", id: "ana-ferreira", antigo: "a", novo: "b" })).toBe("ficha ana-ferreira: trocar um trecho");
    expect(describeOperation({ op: "alfabeto_adicionar", linhas: ["a"] })).toBe("alfabeto.md: acrescentar 1 linha");
    expect(describeOperation({ op: "nao_aprovado", itens: ["a", "b"] })).toBe("não aprovado (2 itens, só para você saber)");
  });
});
