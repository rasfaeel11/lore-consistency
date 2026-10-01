import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

function fixture(path: string): string {
  return fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url));
}

// O git no Windows pode trocar \n por \r\n nas fixtures; comparamos sem essa diferença.
function readNormalized(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

const COMPLETA = fixture("pack/completa");
const PLANO = join(COMPLETA, "plano.md");

describe("pack", () => {
  let tempDir: string;
  let output: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    output = join(tempDir, "pacote.md");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function pack(...args: string[]) {
    return main(["pack", "--cena", PLANO, "--saida", output, ...args, COMPLETA], "0.0.0");
  }

  it("gera o pacote esperado numa pasta completa", () => {
    const result = pack();

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(readNormalized(output)).toBe(readNormalized(fixture("pack/completa-esperado.md")));
  });

  it("o resumo explica por que cada ficha entrou e mostra tokens por seção", () => {
    const { stdout } = pack();

    expect(stdout).toMatch(/ana-ferreira\s+plano\s+casou: "Aninha"/);
    expect(stdout).toMatch(/porto-sal\s+plano\s+casou: "Porto Sal"/);
    expect(stdout).toMatch(/capitao-brum\s+última cena\s+casou: "o Velho"/);
    expect(stdout).not.toContain("guilda-do-sal");
    expect(stdout).toContain("capitulos/cap-02.md");
    expect(stdout).toMatch(/bíblia\s+\d+/);
    expect(stdout).toMatch(/fichas\s+\d+/);
    expect(stdout).toMatch(/última cena\s+\d+/);
    expect(stdout).toMatch(/total\s+~\d+/);
    expect(stdout).toContain("aproximad");
  });

  it("--com e --sem mudam as fichas do pacote", () => {
    const result = pack("--com", "guilda-do-sal", "--sem", "capitao-brum");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/guilda-do-sal\s+forçada/);
    const content = readNormalized(output);
    expect(content).toContain("id: guilda-do-sal");
    expect(content).not.toContain("id: capitao-brum");
  });

  it("--com aceita vários ids separados por vírgula", () => {
    const result = pack("--com", "guilda-do-sal,capitao-brum", "--sem-ultima-cena");

    expect(result.exitCode).toBe(0);
    expect(readNormalized(output)).toContain("id: guilda-do-sal");
    expect(readNormalized(output)).toContain("id: capitao-brum");
  });

  it("id inexistente em --com sai com 1 e não grava nada", () => {
    const result = pack("--com", "guilda");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"guilda"');
    expect(existsSync(output)).toBe(false);
  });

  it("--alfabeto inclui o alfabeto; sem ele, o bloco some", () => {
    pack();
    expect(readNormalized(output)).not.toContain("=== ALFABETO ===");

    pack("--alfabeto");
    expect(readNormalized(output)).toContain("=== ALFABETO ===\n# Alfabeto");
  });

  it("--sem-ultima-cena omite a cena e não usa ela para achar fichas", () => {
    const result = pack("--sem-ultima-cena");

    expect(result.exitCode).toBe(0);
    const content = readNormalized(output);
    expect(content).not.toContain("=== ÚLTIMA CENA ===");
    expect(content).not.toContain("id: capitao-brum");
  });

  it("sobrescreve um pacote gerado antes", () => {
    pack();
    const second = pack("--alfabeto");

    expect(second.exitCode).toBe(0);
    expect(readNormalized(output)).toContain("=== ALFABETO ===");
  });

  it("recusa sobrescrever arquivo que não foi gerado pelo lore-pack", () => {
    writeFileSync(output, "Meu texto importante.\n");

    const result = pack();

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("não foi gerado pelo lore-pack");
    expect(readFileSync(output, "utf8")).toBe("Meu texto importante.\n");
  });

  it("com --limite, avisa em destaque quando passa e aponta a maior seção", () => {
    const result = pack("--limite", "10");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ATENÇÃO");
    expect(result.stdout).toMatch(/maior seção é "(fichas|estado|bíblia|última cena)"/);
  });

  it("com --limite folgado, não avisa", () => {
    expect(pack("--limite", "100000").stdout).not.toContain("ATENÇÃO");
  });

  it("--limite que não é número sai com 1", () => {
    const result = pack("--limite", "muito");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--limite");
  });

  it("sem --saida grava pacote.md na raiz da pasta", () => {
    const story = join(tempDir, "historia");
    cpSync(COMPLETA, story, { recursive: true });

    const result = main(["pack", "--cena", join(story, "plano.md"), story], "0.0.0");

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(story, "pacote.md"))).toBe(true);
  });

  it("sem 00 personalizado e sem capítulos: usa o modelo padrão, avisa e omite a última cena", () => {
    const minima = fixture("pack/minima");

    const result = main(
      ["pack", "--cena", join(minima, "plano.md"), "--saida", output, minima],
      "0.0.0",
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("modelo padrão");
    const content = readNormalized(output);
    expect(content).toContain("Vamos continuar a escrever uma história.");
    expect(content).toContain("id: ana-ferreira");
    expect(content).not.toContain("=== ÚLTIMA CENA ===");
    expect(content).not.toContain("{{");
  });

  it("para sem gravar nada se a validação das fichas tiver erro", () => {
    const broken = fixture("check/erro-campo-ausente");

    const result = main(["pack", "--cena", PLANO, "--saida", output, broken], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[nome]");
    expect(existsSync(output)).toBe(false);
  });

  it("sem --cena sai com 1 e mostra o uso", () => {
    const result = main(["pack", COMPLETA], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--cena");
  });

  it("plano inexistente sai com 1", () => {
    const result = main(["pack", "--cena", join(tempDir, "nao-existe.md"), COMPLETA], "0.0.0");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("não existe");
  });
});

describe("pack com referências", () => {
  const HISTORIA = fixture("pack/referencias");
  let tempDir: string;
  let output: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
    output = join(tempDir, "pacote.md");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function pack(...args: string[]) {
    return main(["pack", "--cena", join(HISTORIA, "plano.md"), "--saida", output, ...args, HISTORIA], "0.0.0");
  }

  it("puxa só as referências cujas palavras-chave aparecem no plano, com motivo e tokens", () => {
    const result = pack();

    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    const content = readNormalized(output);
    expect(content).toContain("=== REFERÊNCIAS DESTA SESSÃO ===");
    expect(content).toContain("id: magia");
    expect(content).toContain("id: combate");
    expect(content).not.toContain("id: geografia");
    // As referências vêm depois das fichas.
    expect(content.indexOf("id: magia")).toBeGreaterThan(content.indexOf("id: ana-ferreira"));

    expect(result.stdout).toMatch(/Referências no pacote \(2\):/);
    expect(result.stdout).toMatch(/combate\s+plano\s+casou: "Baluarte"\s+~\d+ tokens/);
    expect(result.stdout).toMatch(/magia\s+plano\s+casou: "Resto"\s+~\d+ tokens/);
    expect(result.stdout).toMatch(/referências\s+\d+/);
  });

  it("a última cena não puxa referências", () => {
    // A última cena cita "Ordem da Chama" e "Conselho dos Nove".
    const result = pack();

    const content = readNormalized(output);
    expect(content).toContain("Ordem da Chama falou");
    expect(content).not.toContain("id: ordens");
    expect(content).not.toContain("id: politica");
    expect(result.stdout).not.toContain("ordens");
  });

  it("--ref força referências e --sem tira", () => {
    const result = pack("--ref", "ordens,politica", "--sem", "magia");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/ordens\s+forçada/);
    expect(result.stdout).toMatch(/politica\s+forçada/);
    const content = readNormalized(output);
    expect(content).toContain("id: ordens");
    expect(content).toContain("id: combate");
    expect(content).not.toContain("id: magia");
  });

  it("--ref com id inexistente sai com 1 e não grava nada", () => {
    const result = pack("--ref", "magica");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"magica"');
    expect(existsSync(output)).toBe(false);
  });

  it("sem referência escolhida, o bloco some", () => {
    const result = pack("--sem", "magia,combate");

    expect(result.exitCode).toBe(0);
    expect(readNormalized(output)).not.toContain("REFERÊNCIAS");
    expect(result.stdout).toContain("Referências no pacote: nenhuma");
  });

  it("as referências entram no aviso de --limite", () => {
    const result = pack("--limite", "10");

    expect(result.stdout).toContain("ATENÇÃO");
    expect(result.stdout).toMatch(/maior seção é "(referências|bíblia|estado|fichas|última cena)"/);
    expect(result.stdout).toContain("fichas ou referências com --sem");
  });
});
