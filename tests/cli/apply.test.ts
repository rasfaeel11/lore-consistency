import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkGuard } from "../../src/cli/guard.js";
import { main } from "../../src/cli/main.js";
import { TEMPLATES_DIR } from "../../src/cli/paths.js";
import { applyChanges, extractChanges } from "../../src/core/changes.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/apply/historia", import.meta.url));
const ID = "2026-10-01-cap-01-01";

// O fechamento.md do fixture tem 7 operações, nesta ordem:
// 1 estado_adicionar (Capítulos), 2 estado_adicionar (Setups abertos), 3 ficha_adicionar (ana-ferreira),
// 4 ficha_substituir (ana-ferreira), 5 ficha_criar (tobias-vau), 6 alfabeto_adicionar, 7 nao_aprovado.

function run(...args: string[]) {
  return main(args, "0.0.0");
}

describe("apply", () => {
  let tempDir: string;
  let story: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
    cpSync(HISTORIA, story, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function read(path: string): string {
    return readFileSync(join(story, path), "utf8");
  }

  // Todos os arquivos da história, para provar que nada mudou.
  function everything(): Record<string, string> {
    const files: Record<string, string> = {};
    for (const name of readdirSync(story, { recursive: true, encoding: "utf8" })) {
      if (statSync(join(story, name)).isFile()) files[name] = read(name);
    }
    return files;
  }

  function closing(...operations: string[]): void {
    writeFileSync(
      join(story, "sessoes", ID, "fechamento.md"),
      `Fechamento.\n\n\`\`\`lore-pack-mudancas\n{ "operacoes": [ ${operations.join(",\n")} ] }\n\`\`\`\n`,
    );
  }

  it("--help mostra o uso, com saída 0", () => {
    const result = run("apply", "--help");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("lore-pack apply <id-da-sessão>");
    expect(result.stdout).toContain("--aplicar");
  });

  it("sem --aplicar, mostra a lista numerada com o diff e não grava nada", () => {
    const before = everything();

    const result = run("apply", ID, story);

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('[1] estado.md: acrescentar 1 linha em "Capítulos"');
    expect(result.stdout).toContain("+ cap-01: Ana chega a Porto Sal e conhece o faroleiro.");
    expect(result.stdout).toContain("[5] criar a ficha tobias-vau (personagem)");
    expect(result.stdout).toContain("arquivo novo: fichas/personagens/tobias-vau.md");
    expect(result.stdout).toContain("[7] não aprovado");
    expect(result.stdout).toContain("- O farol ser assombrado.");
    expect(result.stdout).toContain("Nada foi gravado.");
    expect(result.stdout).toContain(`lore-pack apply ${ID} --aplicar todas`);
    expect(everything()).toEqual(before);
  });

  it("--aplicar 1,3,5 grava só essas, anota no aplicado.json e mostra o check", () => {
    const result = run("apply", ID, "--aplicar", "1,3,5", story);

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(read("estado.md")).toContain("cap-01: Ana chega a Porto Sal e conhece o faroleiro.");
    expect(read("estado.md")).not.toContain("a lanterna apagada");
    expect(read("fichas/personagens/ana-ferreira.md")).toContain("- Conheceu o faroleiro Tobias (cap-01).");
    expect(read("fichas/personagens/ana-ferreira.md")).toContain("status: viva");
    expect(read("fichas/personagens/tobias-vau.md")).toContain("nome: Tobias Vau");
    expect(read("alfabeto.md")).not.toContain("Tobias Vau");

    expect(result.stdout).toContain("3 operações aplicadas (1, 3, 5)");
    expect(result.stdout).toContain("Tudo certo: 3 fichas validadas.");
    expect(result.stdout).toContain("Ainda não aplicadas: 2, 4, 6");
    expect(result.stdout).toContain(`lore-pack sessao fechar ${ID}`);

    const record = JSON.parse(read(`sessoes/${ID}/aplicado.json`));
    expect(record.indices).toEqual([1, 3, 5]);
    expect(record.fechamento_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isNaN(Date.parse(record.aplicado_em))).toBe(false);
  });

  it("--aplicar todas grava todas as que faltam", () => {
    run("apply", ID, "--aplicar", "2", story);

    const result = run("apply", ID, "--aplicar", "todas", story);

    expect(result.stdout).toContain("5 operações aplicadas (1, 3, 4, 5, 6)");
    expect(read("fichas/personagens/ana-ferreira.md")).toContain("status: ferida");
    expect(read("alfabeto.md")).toContain("- Tobias Vau | faroleiro | costeiros | cap-01");
    expect(JSON.parse(read(`sessoes/${ID}/aplicado.json`)).indices).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("segunda execução não duplica: as aplicadas aparecem como 'já aplicada' e não podem ser escolhidas", () => {
    run("apply", ID, "--aplicar", "1,2", story);
    const before = everything();

    const list = run("apply", ID, story);
    const again = run("apply", ID, "--aplicar", "1", story);

    expect(list.stdout).toContain('[1] estado.md: acrescentar 1 linha em "Capítulos" (já aplicada)');
    expect(list.stdout).toContain('[3] ficha ana-ferreira: acrescentar 1 linha em "Fatos"\n');
    expect(again.exitCode).toBe(1);
    expect(again.stderr).toContain("A operação 1 já foi aplicada.");
    expect(everything()).toEqual(before);
    expect(read("estado.md").split("cap-01: Ana chega a Porto Sal").length - 1).toBe(1);
  });

  it("depois de aplicar todas, não sobra nada para aplicar", () => {
    run("apply", ID, "--aplicar", "todas", story);

    expect(run("apply", ID, story).stdout).toContain("Não há nenhuma operação para aplicar.");
    expect(run("apply", ID, "--aplicar", "todas", story).stderr).toContain("Não há nenhuma operação para aplicar");
  });

  it("se o fechamento.md mudou, é tratado como um fechamento novo, com aviso", () => {
    run("apply", ID, "--aplicar", "1", story);
    closing('{ "op": "alfabeto_adicionar", "linhas": ["- Tobias Vau | faroleiro | costeiros | cap-01"] }');

    const list = run("apply", ID, story);

    expect(list.stdout).toContain("tratado como um fechamento novo");
    expect(list.stdout).toContain("[1] alfabeto.md: acrescentar 1 linha\n");
    expect(list.stdout).not.toContain("já aplicada");
  });

  it("índice que não existe, operação informativa e operação com erro: nada é gravado", () => {
    closing(
      '{ "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["cap-01: Ana chega."] }',
      '{ "op": "estado_adicionar", "secao": "Personagens", "linhas": ["x"] }',
      '{ "op": "nao_aprovado", "itens": ["nada"] }',
    );
    const before = everything();

    const list = run("apply", ID, story);
    const missing = run("apply", ID, "--aplicar", "1,9", story);
    const info = run("apply", ID, "--aplicar", "3", story);
    const broken = run("apply", ID, "--aplicar", "1,2", story);

    expect(list.stdout).toContain('Não dá para aplicar: A seção "Personagens" não existe');
    expect(missing.stderr).toContain("A operação 9 não existe");
    expect(info.stderr).toContain("A operação 3 é só informativa");
    expect(broken.stderr).toContain('A operação 2 não pode ser aplicada: A seção "Personagens" não existe');
    expect([missing.exitCode, info.exitCode, broken.exitCode]).toEqual([1, 1, 1]);
    expect(everything()).toEqual(before);
  });

  it("operação que depende de outra que não foi escolhida: nada é gravado", () => {
    closing(
      '{ "op": "ficha_criar", "tipo": "lugar", "id": "farol", "conteudo": "---\\nid: farol\\ntipo: lugar\\nnome: Farol\\n---\\n**Fatos:**\\n- Apagado.\\n" }',
      '{ "op": "ficha_adicionar", "id": "farol", "secao": "Fatos", "linhas": ["- Tem 90 degraus."] }',
    );
    const before = everything();

    const result = run("apply", ID, "--aplicar", "2", story);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('A ficha "farol" não existe');
    expect(result.stderr).toContain("Nada foi alterado.");
    expect(everything()).toEqual(before);
  });

  it("valor inválido em --aplicar", () => {
    for (const value of ["", "tudo", "1,,2", "0", "1;2", "-1"]) {
      const result = run("apply", ID, `--aplicar=${value}`, story);
      expect(result.stderr, value).toContain("--aplicar precisa dos números");
    }
  });

  it("bloco inválido: mostra o erro e o texto para colar de volta na IA, sem gravar nada", () => {
    closing('{ "op": "ficha_adicionar", "id": "../../biblia", "secao": "x", "linhas": ["y"] }');
    const before = everything();

    const result = run("apply", ID, "--aplicar", "todas", story);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`sessoes/${ID}/fechamento.md`);
    expect(result.stderr).toContain('O id "../../biblia" é inválido');
    expect(result.stderr).toContain("Reenvie só o bloco");
    expect(everything()).toEqual(before);
  });

  it("fechamento sem operações", () => {
    closing();

    expect(run("apply", ID, story).stdout).toContain("não traz nenhuma operação");
  });

  it("erros de uso: sem id, sessão que não existe, sem fechamento.md", () => {
    expect(run("apply").stderr).toContain("Informe o id da sessão");
    expect(run("apply", "2026-10-01-cap-01-09", story).stderr).toContain("não existe em sessoes/");

    rmSync(join(story, "sessoes", ID, "fechamento.md"));
    const result = run("apply", ID, story);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`sessoes/${ID}/fechamento.md não existe`);
    expect(result.stderr).toContain("prompt 04");
  });

  it("mantém as quebras de linha do Windows de um arquivo que já as usava", () => {
    writeFileSync(join(story, "estado.md"), read("estado.md").replace(/\r?\n/g, "\r\n"));

    run("apply", ID, "--aplicar", "1", story);

    const estado = read("estado.md");
    expect(estado).toContain("cap-01: Ana chega a Porto Sal e conhece o faroleiro.\r\n");
    expect(estado.replace(/\r\n/g, "")).not.toContain("\n");
  });

  describe("guarda do cânone", () => {
    it("recusa enquanto houver alteração direta não resolvida, até para listar", () => {
      run("sessao", "verificar", ID, "--vigiar", story);
      writeFileSync(join(story, "biblia.md"), "# Bíblia\n\nMudada por fora.\n");
      const before = everything();

      const list = run("apply", ID, story);
      const result = run("apply", ID, "--aplicar", "todas", story);

      expect(list.exitCode).toBe(1);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("biblia.md");
      expect(result.stderr).toContain("antes de aplicar o fechamento");
      expect(everything()).toEqual(before);
    });

    it("tira um snapshot novo depois de aplicar: a guarda não acusa, e a sessão fecha", () => {
      run("sessao", "verificar", ID, "--vigiar", story);

      run("apply", ID, "--aplicar", "todas", story);

      expect(checkGuard(story, ID)?.changes).toEqual([]);
      const closed = run("sessao", "fechar", ID, story);
      expect(closed.stderr).toBe("");
      expect(closed.stdout).toContain(`Sessão ${ID} fechada.`);
    });

    it("sessão sem snapshot continua sem snapshot", () => {
      run("apply", ID, "--aplicar", "1", story);

      expect(checkGuard(story, ID)).toBeUndefined();
      expect(existsSync(join(story, ".lore-pack"))).toBe(false);
    });
  });

  it("funciona numa sessão já fechada", () => {
    run("sessao", "fechar", ID, story);

    const result = run("apply", ID, "--aplicar", "1", story);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("sessao fechar");
  });

  it("o sessao fechar aponta para o apply", () => {
    expect(run("sessao", "fechar", ID, story).stdout).toContain(`lore-pack apply ${ID}`);
  });
});

describe("prompt 04-fechar-sessao (modelo do init)", () => {
  const template = (name: string) => readFileSync(join(TEMPLATES_DIR, name), "utf8").replace(/\r\n/g, "\n");

  it("o exemplo do prompt é um bloco válido, com todas as operações", () => {
    const extracted = extractChanges(template("prompts-de-sessao/04-fechar-sessao.md"));
    if (!extracted.ok) throw new Error(extracted.error);

    expect(extracted.operations.map((operation) => operation.op).sort()).toEqual([
      "alfabeto_adicionar",
      "estado_adicionar",
      "estado_adicionar",
      "estado_substituir",
      "ficha_adicionar",
      "ficha_criar",
      "ficha_substituir",
      "nao_aprovado",
    ]);
  });

  it("as seções que o exemplo cita existem nos modelos de estado.md e alfabeto.md", () => {
    const extracted = extractChanges(template("prompts-de-sessao/04-fechar-sessao.md"));
    if (!extracted.ok) throw new Error(extracted.error);
    const files = [
      { path: "estado.md", content: template("estado.md") },
      { path: "alfabeto.md", content: template("alfabeto.md") },
    ];
    const onTemplates = extracted.operations.filter((operation) => operation.op === "estado_adicionar" || operation.op === "alfabeto_adicionar");

    const result = applyChanges(onTemplates, files);

    expect(result.ok ? "" : result.error).toBe("");
  });
});
