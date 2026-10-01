import { describe, expect, it } from "vitest";
import {
  buildPack,
  hasPackMarkers,
  isGeneratedByPack,
  PACK_MARK,
  type PackSections,
} from "../../src/core/pack.js";

const TEMPLATE = `Quando usar: primeira mensagem.

## Copie a partir daqui

Vamos escrever.

=== BÍBLIA ===
{{biblia}}

=== ESTADO ===
{{estado}}

=== FICHAS ===
{{fichas}}

=== ALFABETO ===
{{alfabeto}}

=== ÚLTIMA CENA ===
{{ultima_cena}}
`;

const FULL: PackSections = {
  biblia: "Regras do mundo.",
  estado: "Capítulo 2 em andamento.",
  fichas: "ficha da Ana",
  // Sem marcador no TEMPLATE: conteúdo de seção sem marcador não entra no pacote.
  referencias: "magia",
  alfabeto: "nomes",
  ultima_cena: "Ana olhou o mar.",
};

describe("buildPack", () => {
  it("preenche todos os blocos e mantém só o texto depois de 'Copie a partir daqui'", () => {
    expect(buildPack(TEMPLATE, FULL)).toBe(`Vamos escrever.

=== BÍBLIA ===
Regras do mundo.

=== ESTADO ===
Capítulo 2 em andamento.

=== FICHAS ===
ficha da Ana

=== ALFABETO ===
nomes

=== ÚLTIMA CENA ===
Ana olhou o mar.
`);
  });

  it("omite o bloco inteiro, com o título, quando o conteúdo está vazio", () => {
    const result = buildPack(TEMPLATE, { ...FULL, alfabeto: "", ultima_cena: "  \n" });

    expect(result).not.toContain("ALFABETO");
    expect(result).not.toContain("ÚLTIMA CENA");
    expect(result).toContain("=== FICHAS ===\nficha da Ana\n");
    expect(result.endsWith("ficha da Ana\n")).toBe(true);
  });

  it("usa o modelo inteiro quando não há a linha 'Copie a partir daqui'", () => {
    expect(buildPack("Oi.\n=== B ===\n{{biblia}}\n", FULL)).toBe("Oi.\n=== B ===\nRegras do mundo.\n");
  });

  it("não deixa linhas em branco sobrando nas pontas do conteúdo", () => {
    const result = buildPack(TEMPLATE, { ...FULL, biblia: "\n\nRegras.\n\n\n" });

    expect(result).toContain("=== BÍBLIA ===\nRegras.\n\n=== ESTADO ===");
  });
});

describe("hasPackMarkers", () => {
  it("reconhece modelo com marcadores e modelo antigo sem eles", () => {
    expect(hasPackMarkers(TEMPLATE)).toBe(true);
    expect(hasPackMarkers("=== BÍBLIA ===\n[COLE AQUI]\n")).toBe(false);
  });
});

describe("isGeneratedByPack", () => {
  it("só reconhece arquivo que começa com a marca do lore-pack", () => {
    expect(isGeneratedByPack(`${PACK_MARK}\nVamos escrever.`)).toBe(true);
    expect(isGeneratedByPack(`﻿${PACK_MARK}\r\nVamos escrever.`)).toBe(true);
    expect(isGeneratedByPack("Meu texto importante.")).toBe(false);
    expect(isGeneratedByPack(`Meu texto.\n${PACK_MARK}`)).toBe(false);
  });
});
