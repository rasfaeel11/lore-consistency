import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

// Pasta de história criada antes do M4b: não tem CLAUDE.md, AGENTS.md nem .claude/.
const ANTIGA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));

describe("instruções para a IA", () => {
  let tempDir: string;
  let story: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    story = join(tempDir, "historia");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const read = (path: string) => readFileSync(join(story, path), "utf8");
  const update = (...args: string[]) => main(["atualizar-instrucoes", ...args, story], "0.0.0");

  describe("init", () => {
    it("cria CLAUDE.md e AGENTS.md iguais, com o formato novo e as regras", () => {
      main(["init", story], "0.0.0");

      const claude = read("CLAUDE.md");
      expect(read("AGENTS.md")).toBe(claude);
      expect(claude).toContain("relacionados: [oto-varga, sino-mudo]");
      expect(claude).toContain("## Segredo do autor");
      expect(claude).toContain("## Na história");
      expect(claude).toContain("tipo: referencia");
      expect(claude).toContain("sessoes/<id>/rascunho.md");
      expect(claude).toContain("sessoes/<id>/fechamento.md");
      expect(claude).toContain("**Com pedido do autor:**");
      expect(claude).toContain("pergunte em vez de inventar");
      expect(claude).toContain("rode `lore-pack check`");
      // É lido em toda conversa: não pode crescer sem ninguém ver.
      expect(claude.split("\n").length).toBeLessThanOrEqual(125);
    });

    it("o .claude/settings.json deixa a IA editar o cânone, mas não as próprias regras", () => {
      main(["init", story], "0.0.0");

      const deny: string[] = JSON.parse(read(".claude/settings.json")).permissions.deny;
      expect(deny).toEqual(
        expect.arrayContaining(["Edit(/CLAUDE.md)", "Edit(/AGENTS.md)", "Edit(/.claude/settings.json)", "Edit(/lore-pack.config.json)"]),
      );
      expect(deny.some((rule) => /biblia|estado|fichas|referencias|capitulos/.test(rule))).toBe(false);
    });

    it("os exemplos de ficha e de referência do CLAUDE.md passam no check", () => {
      main(["init", story], "0.0.0");
      // Os blocos recuados com quatro espaços que começam em "---" são os exemplos.
      const blocks = [...read("CLAUDE.md").matchAll(/(?:^ {4}.*\n|^\n)+/gm)]
        .map((match) => match[0].replace(/^ {4}/gm, "").trim())
        .filter((block) => block.startsWith("---"));
      expect(blocks).toHaveLength(2);
      mkdirSync(join(story, "fichas", "faccoes"), { recursive: true });
      mkdirSync(join(story, "fichas", "personagens"), { recursive: true });
      mkdirSync(join(story, "fichas", "objetos"), { recursive: true });
      mkdirSync(join(story, "referencias"), { recursive: true });
      writeFileSync(join(story, "fichas", "faccoes", "guilda-dos-sineiros.md"), `${blocks[0]}\n`);
      writeFileSync(join(story, "fichas", "personagens", "oto-varga.md"), "---\nid: oto-varga\ntipo: personagem\nnome: Oto Varga\n---\n");
      writeFileSync(join(story, "fichas", "objetos", "sino-mudo.md"), "---\nid: sino-mudo\ntipo: objeto\nnome: Sino Mudo\n---\n");
      writeFileSync(join(story, "referencias", "sinos.md"), `${blocks[1]}\n`);

      expect(main(["check", story], "0.0.0").stdout).toBe("Tudo certo: 3 fichas validadas, 1 referência validada.\n");
    });

    it("a pasta criada continua passando no check", () => {
      main(["init", story], "0.0.0");

      expect(main(["check", story], "0.0.0").exitCode).toBe(0);
    });
  });

  describe("atualizar-instrucoes", () => {
    it("copia o instrucoes-da-historia.md para o fim do CLAUDE.md e do AGENTS.md, e não mexe nele", () => {
      main(["init", story], "0.0.0");
      const extras = "- Nome antigo vai no campo `nome_antigo` da ficha.\n";
      writeFileSync(join(story, "instrucoes-da-historia.md"), extras);

      const result = update();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("atualizado: CLAUDE.md");
      expect(read("CLAUDE.md")).toContain("## Regras desta história");
      expect(read("CLAUDE.md").endsWith(extras)).toBe(true);
      expect(read("AGENTS.md")).toBe(read("CLAUDE.md"));
      expect(read("instrucoes-da-historia.md")).toBe(extras);
      expect(update().stdout).toContain("já estão atualizados");
    });

    it("em pasta recém-criada, diz que já está tudo atualizado e não muda nada", () => {
      main(["init", story], "0.0.0");
      const before = read("CLAUDE.md");

      const result = update();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("já estão atualizados");
      expect(read("CLAUDE.md")).toBe(before);
    });

    it("em pasta antiga, sem os arquivos, cria os três", () => {
      cpSync(ANTIGA, story, { recursive: true });

      const result = update();

      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("criado: CLAUDE.md");
      expect(existsSync(join(story, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(story, ".claude", "settings.json"))).toBe(true);
      expect(update().stdout).toContain("já estão atualizados");
    });

    it("arquivo gerado por versão antiga e não editado pelo autor é atualizado sem perguntar", () => {
      cpSync(ANTIGA, story, { recursive: true });
      update();
      // Simula a versão anterior: o lore-pack gravou este texto e guardou o hash dele.
      writeFileSync(join(story, "CLAUDE.md"), "# Versão antiga\n");
      const hashes = JSON.parse(read(".lore-pack/instrucoes.json"));
      hashes["CLAUDE.md"] = createHash("sha256").update("# Versão antiga\n").digest("hex");
      writeFileSync(join(story, ".lore-pack", "instrucoes.json"), JSON.stringify(hashes));

      const result = update();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("atualizado: CLAUDE.md");
      expect(read("CLAUDE.md")).toBe(read("AGENTS.md"));
    });

    it("arquivo editado pelo autor: mostra o diff, não grava nada e pede --sobrescrever", () => {
      main(["init", story], "0.0.0");
      writeFileSync(join(story, "AGENTS.md"), "Minhas regras.\n");

      const result = update();

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("AGENTS.md");
      expect(result.stderr).toContain("- Minhas regras.");
      expect(result.stderr).toContain("--sobrescrever");
      expect(read("AGENTS.md")).toBe("Minhas regras.\n");
    });

    it("com --sobrescrever, troca o arquivo editado", () => {
      main(["init", story], "0.0.0");
      writeFileSync(join(story, "AGENTS.md"), "Minhas regras.\n");

      const result = update("--sobrescrever");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sobrescrito: AGENTS.md");
      expect(read("AGENTS.md")).toBe(read("CLAUDE.md"));
    });

    it("sem registro de hash e com texto diferente, trata como editado pelo autor", () => {
      cpSync(ANTIGA, story, { recursive: true });
      writeFileSync(join(story, "CLAUDE.md"), "Escrito à mão.\n");

      const result = update();

      expect(result.exitCode).toBe(1);
      expect(read("CLAUDE.md")).toBe("Escrito à mão.\n");
      expect(existsSync(join(story, "AGENTS.md"))).toBe(false);
    });

    it("quebra de linha \\r\\n (git no Windows) não conta como edição", () => {
      main(["init", story], "0.0.0");
      writeFileSync(join(story, "CLAUDE.md"), read("CLAUDE.md").replace(/\n/g, "\r\n"));

      expect(update().stdout).toContain("já estão atualizados");
    });

    it("pasta que não é história dá erro", () => {
      const result = main(["atualizar-instrucoes", tempDir], "0.0.0");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("biblia.md");
    });
  });
});
