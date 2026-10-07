import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function run(...args: string[]) {
  return main(args, "0.0.0");
}

describe("sessao", () => {
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

  function sessionFolders(): string[] {
    return readdirSync(join(story, "sessoes")).sort();
  }

  describe("listar", () => {
    it("mostra os capítulos em ordem com as sessões e o status de cada uma", () => {
      const result = run("sessao", "listar", story);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /cap-01 +A chegada\n +2026-09-20-cap-01-01 +fechada\n+cap-02 +O cais\n +2026-09-28-cap-02-01 +fechada\n +2026-09-30-cap-02-02 +aberta/,
      );
    });

    it("capítulo sem sessão aparece com 'nenhuma sessão'", () => {
      run("capitulo", "novo", "A tempestade", story);

      expect(run("sessao", "listar", story).stdout).toMatch(/cap-03 +A tempestade\n +nenhuma sessão/);
    });

    it("avisa quando há sessão com erro, que fica fora da lista", () => {
      writeFileSync(join(story, "sessoes", "2026-09-30-cap-02-02", "sessao.md"), "sem cabeçalho");

      const { stdout } = run("sessao", "listar", story);

      expect(stdout).not.toContain("2026-09-30-cap-02-02");
      expect(stdout).toContain("lore-pack check");
    });
  });

  describe("nova", () => {
    it("cria a pasta da sessão com sessao.md e pacote.md e sugere o comando de início", () => {
      const result = run("sessao", "nova", "--capitulo", "cap-02", "--plano", join(story, "plano.md"), story);

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      const created = sessionFolders().find((name) => /^\d{4}-\d{2}-\d{2}-cap-02-03$/.test(name));
      expect(created).toBeDefined();
      const folder = join(story, "sessoes", created ?? "");

      expect(read(join(folder, "sessao.md"))).toContain("status: aberta");
      expect(read(join(folder, "sessao.md"))).toContain("Ana encontra o capitão no farol.");
      const pacote = read(join(folder, "pacote.md"));
      expect(pacote.startsWith("<!-- lore-pack:")).toBe(true);
      expect(pacote).toContain("id: ana-ferreira");
      expect(pacote).toContain("Aninha escondeu o mapa.");

      expect(result.stdout).toContain(`claude "Leia o arquivo sessoes/${created}/pacote.md e siga as instruções dele. Escreva o texto das cenas em sessoes/${created}/rascunho.md e, ao final, as propostas de mudança em sessoes/${created}/fechamento.md. Não edite nenhum outro arquivo sem eu pedir."`);
      expect(pacote).toContain("=== ARQUIVOS DESTA SESSÃO ===");
      expect(pacote).toContain(`sessoes/${created}/rascunho.md`);
      expect(run("check", story).exitCode).toBe(0);
    });

    it("em capítulo novo, sem texto, a última cena vem do capítulo anterior", () => {
      run("capitulo", "novo", "A tempestade", story);

      const result = run("sessao", "nova", "--capitulo", "cap-03", "--plano", join(story, "plano.md"), story);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Última cena: capitulos/cap-02.md");
    });

    it("aceita as opções do pack", () => {
      const result = run(
        "sessao", "nova", "--capitulo", "cap-01", "--plano", join(story, "plano.md"),
        "--sem", "ana-ferreira", "--sem-ultima-cena", story,
      );

      expect(result.exitCode).toBe(0);
      const created = sessionFolders().find((name) => name.endsWith("-cap-01-02")) ?? "";
      expect(read(join(story, "sessoes", created, "pacote.md"))).not.toContain("id: ana-ferreira");
    });

    it("capítulo inexistente vira erro claro e não cria nada", () => {
      const before = sessionFolders();

      const result = run("sessao", "nova", "--capitulo", "cap-09", "--plano", join(story, "plano.md"), story);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('"cap-09" não existe');
      expect(result.stderr).toContain("cap-01, cap-02");
      expect(sessionFolders()).toEqual(before);
    });

    it("sem --plano sai com 1", () => {
      const result = run("sessao", "nova", "--capitulo", "cap-02", story);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--plano");
    });

    it("se o pack falhar, não deixa pasta de sessão para trás", () => {
      const before = sessionFolders();

      const result = run(
        "sessao", "nova", "--capitulo", "cap-02", "--plano", join(story, "plano.md"), "--com", "ninguem", story,
      );

      expect(result.exitCode).toBe(1);
      expect(sessionFolders()).toEqual(before);
    });
  });

  describe("fechar", () => {
    const OPEN = "2026-09-30-cap-02-02";

    it("marca como fechada, grava fechada_em e copia o fechamento", () => {
      const result = run("sessao", "fechar", OPEN, "--fechamento", join(story, "fechamento.md"), story);

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      const sessao = read(join(story, "sessoes", OPEN, "sessao.md"));
      expect(sessao).toContain("status: fechada");
      expect(sessao).toMatch(/fechada_em: .*\d{4}-\d{2}-\d{2}T/);
      expect(sessao).toContain("Ana esconde o mapa.");
      expect(read(join(story, "sessoes", OPEN, "fechamento.md"))).toBe(read(join(story, "fechamento.md")));
      expect(run("check", story).exitCode).toBe(0);
    });

    it("--resumo acrescenta o resumo no sessao.md", () => {
      run("sessao", "fechar", OPEN, "--resumo", "Ana escondeu o mapa no farol.", story);

      expect(read(join(story, "sessoes", OPEN, "sessao.md"))).toContain(
        "## Resumo\n\nAna escondeu o mapa no farol.\n",
      );
    });

    it("sessão já fechada vira erro claro e não altera nada", () => {
      const path = join(story, "sessoes", "2026-09-28-cap-02-01", "sessao.md");
      const before = read(path);

      const result = run("sessao", "fechar", "2026-09-28-cap-02-01", story);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("já está fechada");
      expect(read(path)).toBe(before);
    });

    it("sessão inexistente vira erro claro", () => {
      const result = run("sessao", "fechar", "2026-01-01-cap-01-01", story);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("sessao listar");
    });

    it("arquivo de fechamento inexistente não fecha a sessão", () => {
      const result = run("sessao", "fechar", OPEN, "--fechamento", join(story, "nao-existe.md"), story);

      expect(result.exitCode).toBe(1);
      expect(read(join(story, "sessoes", OPEN, "sessao.md"))).toContain("status: aberta");
    });
  });

  it("critério de aceite: dois capítulos, duas sessões no segundo, uma fechada", () => {
    const nova = join(tempDir, "nova");
    run("init", nova);
    writeFileSync(join(nova, "plano.md"), "Plano da cena.\n");
    const plano = join(nova, "plano.md");

    expect(run("capitulo", "novo", "Primeiro", nova).exitCode).toBe(0);
    expect(run("capitulo", "novo", "Segundo", nova).exitCode).toBe(0);
    expect(run("sessao", "nova", "--capitulo", "cap-02", "--plano", plano, nova).exitCode).toBe(0);
    expect(run("sessao", "nova", "--capitulo", "cap-02", "--plano", plano, nova).exitCode).toBe(0);
    const [first] = readdirSync(join(nova, "sessoes")).sort();
    expect(run("sessao", "fechar", first ?? "", nova).exitCode).toBe(0);

    const { stdout } = run("sessao", "listar", nova);
    expect(stdout).toMatch(/cap-01 +Primeiro\n +nenhuma sessão/);
    expect(stdout).toMatch(/cap-02 +Segundo\n +\S+-cap-02-01 +fechada\n +\S+-cap-02-02 +aberta/);
  });
});
