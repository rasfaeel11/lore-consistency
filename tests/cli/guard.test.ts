import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkGuard, hasSnapshot, keepChanges, revertChanges, takeSnapshot } from "../../src/cli/guard.js";
import { main } from "../../src/cli/main.js";

const HISTORIA = fileURLToPath(new URL("../fixtures/sessoes/historia", import.meta.url));
const OPEN = "2026-09-30-cap-02-02";
const ANA = "fichas/personagens/ana-ferreira.md";

function run(...args: string[]) {
  return main(args, "0.0.0");
}

describe("guarda do cânone", () => {
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

  const file = (path: string) => join(story, path);
  // Bytes exatos, para conferir que o Reverter não muda nem a quebra de linha.
  const bytes = (path: string) => readFileSync(file(path));

  describe("snapshot e verificação", () => {
    it("guarda o snapshot em .lore-pack/, fora do git", () => {
      takeSnapshot(story, OPEN);

      expect(hasSnapshot(story, OPEN)).toBe(true);
      expect(readFileSync(file(".lore-pack/.gitignore"), "utf8")).toBe("*\n");
    });

    it("sem mudança, nada a acusar", () => {
      takeSnapshot(story, OPEN);

      expect(checkGuard(story, OPEN)?.changes).toEqual([]);
    });

    it("acusa arquivo protegido alterado, apagado e criado, com o diff", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file(ANA), bytes(ANA).toString("utf8").replace("Ana Ferreira", "Ana Pereira"));
      rmSync(file("estado.md"));
      mkdirSync(file("referencias"));
      writeFileSync(file("referencias/magia.md"), "O Resto custa memória.\n");

      const report = checkGuard(story, OPEN);

      expect(report?.changes.map((c) => [c.kind, c.path])).toEqual([
        ["apagado", "estado.md"],
        ["alterado", ANA],
        ["criado", "referencias/magia.md"],
      ]);
      const ana = report?.changes.find((c) => c.path === ANA);
      expect(ana?.diff).toContain("- nome: Ana Ferreira");
      expect(ana?.diff).toContain("+ nome: Ana Pereira");
      expect(report?.changes.find((c) => c.kind === "criado")?.diff).toBe("+ O Resto custa memória.");
    });

    it("rascunho.md e fechamento.md da sessão não disparam", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file(`sessoes/${OPEN}/rascunho.md`), "Cena nova.\n");
      writeFileSync(file(`sessoes/${OPEN}/fechamento.md`), "Propostas.\n");

      expect(checkGuard(story, OPEN)?.changes).toEqual([]);
    });

    it("sessão sem snapshot devolve undefined", () => {
      expect(hasSnapshot(story, OPEN)).toBe(false);
      expect(checkGuard(story, OPEN)).toBeUndefined();
    });

    it("o check ignora a pasta .lore-pack/", () => {
      takeSnapshot(story, OPEN);

      expect(run("check", story).exitCode).toBe(0);
    });
  });

  describe("Reverter", () => {
    it("restaura exatamente o que havia, apaga o criado e devolve o apagado", () => {
      writeFileSync(file("biblia.md"), "Linha um\r\nLinha dois\r\n");
      const biblia = bytes("biblia.md");
      const ana = bytes(ANA);
      const estado = bytes("estado.md");
      takeSnapshot(story, OPEN);

      writeFileSync(file("biblia.md"), "Outra coisa\n");
      writeFileSync(file(ANA), "estragada");
      rmSync(file("estado.md"));
      writeFileSync(file("capitulos/cap-09.md"), "# Novo\n");

      const reverted = revertChanges(story, OPEN);

      expect(reverted.map((c) => c.path)).toEqual(["biblia.md", "capitulos/cap-09.md", "estado.md", ANA]);
      expect(bytes("biblia.md")).toEqual(biblia);
      expect(bytes(ANA)).toEqual(ana);
      expect(bytes("estado.md")).toEqual(estado);
      expect(existsSync(file("capitulos/cap-09.md"))).toBe(false);
      expect(checkGuard(story, OPEN)?.changes).toEqual([]);
    });
  });

  describe("Manter", () => {
    it("registra em alteracoes-diretas.md e passa a vigiar a partir do estado atual", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file(ANA), "nova versão");

      const kept = keepChanges(story, OPEN);

      expect(kept).toEqual([{ path: ANA, kind: "alterado" }]);
      const log = readFileSync(file(`sessoes/${OPEN}/alteracoes-diretas.md`), "utf8");
      expect(log).toContain("# Alterações diretas");
      expect(log).toContain(`- alterado: ${ANA}`);
      expect(checkGuard(story, OPEN)?.changes).toEqual([]);
    });

    it("um segundo Manter acrescenta, sem apagar o registro anterior", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file(ANA), "v2");
      keepChanges(story, OPEN);
      writeFileSync(file("estado.md"), "v2");
      keepChanges(story, OPEN);

      const log = readFileSync(file(`sessoes/${OPEN}/alteracoes-diretas.md`), "utf8");
      expect(log).toContain(`- alterado: ${ANA}`);
      expect(log).toContain("- alterado: estado.md");
      expect(log.match(/# Alterações diretas/g)).toHaveLength(1);
    });
  });

  describe("CLI", () => {
    it("sessao nova já tira o snapshot", () => {
      run("sessao", "nova", "--capitulo", "cap-02", "--plano", file("plano.md"), story);
      const created = readdirSync(file("sessoes")).find((name) => name.endsWith("-cap-02-03")) ?? "";

      expect(hasSnapshot(story, created)).toBe(true);
    });

    it("sessao verificar mostra os arquivos alterados e o diff", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file("estado.md"), "Mudado pela IA.\n");

      const result = run("sessao", "verificar", OPEN, story);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alterado: estado.md");
      expect(result.stdout).toContain("+ Mudado pela IA.");
      expect(result.stdout).toContain("--reverter");
    });

    it("sessao verificar sem mudança diz que está tudo igual", () => {
      takeSnapshot(story, OPEN);

      expect(run("sessao", "verificar", OPEN, story).stdout).toContain("nenhum arquivo protegido mudou");
    });

    it("sessao verificar --reverter e --manter", () => {
      takeSnapshot(story, OPEN);
      const estado = bytes("estado.md");
      writeFileSync(file("estado.md"), "x");

      expect(run("sessao", "verificar", OPEN, "--reverter", story).stdout).toContain("Revertido");
      expect(bytes("estado.md")).toEqual(estado);

      writeFileSync(file("estado.md"), "y");
      expect(run("sessao", "verificar", OPEN, "--manter", story).stdout).toContain("alteracoes-diretas.md");
      expect(readFileSync(file("estado.md"), "utf8")).toBe("y");
    });

    it("--reverter e --manter juntos é erro", () => {
      takeSnapshot(story, OPEN);

      expect(run("sessao", "verificar", OPEN, "--reverter", "--manter", story).exitCode).toBe(1);
    });

    it("sessão sem snapshot: explica e oferece --vigiar", () => {
      const result = run("sessao", "verificar", OPEN, story);
      expect(result.stdout).toContain("--vigiar");

      expect(run("sessao", "verificar", OPEN, "--vigiar", story).exitCode).toBe(0);
      expect(hasSnapshot(story, OPEN)).toBe(true);
    });

    it("sessao fechar recusa enquanto houver alteração não resolvida", () => {
      takeSnapshot(story, OPEN);
      writeFileSync(file(ANA), "mexida");

      const result = run("sessao", "fechar", OPEN, story);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`alterado: ${ANA}`);
      expect(readFileSync(file(`sessoes/${OPEN}/sessao.md`), "utf8")).toContain("status: aberta");

      run("sessao", "verificar", OPEN, "--manter", story);
      expect(run("sessao", "fechar", OPEN, story).exitCode).toBe(0);
    });

    it("sessao fechar sem snapshot fecha e avisa que não verificou", () => {
      const result = run("sessao", "fechar", OPEN, story);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sem snapshot");
    });
  });
});
