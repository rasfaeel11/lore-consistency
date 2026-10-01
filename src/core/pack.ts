export const PACK_MARKERS = ["biblia", "estado", "fichas", "alfabeto", "ultima_cena"] as const;

// Conteúdo de cada marcador {{...}} do modelo de abertura de sessão.
export type PackSections = Record<(typeof PACK_MARKERS)[number], string>;

// Primeira linha de todo arquivo gerado pelo pack. É o que autoriza o pack a sobrescrevê-lo.
// A checagem usa só o começo ("<!-- lore-pack:"), para continuar valendo se o texto mudar.
const PACK_MARK_PREFIX = "<!-- lore-pack:";
export const PACK_MARK = `${PACK_MARK_PREFIX} arquivo gerado pelo comando pack. Ele pode ser sobrescrito; não escreva nada importante aqui. -->`;

// Só o que vem depois desta linha é a mensagem que vai para a IA.
const COPY_FROM_LINE = /^##\s*Copie a partir daqui\s*$/;
// Título de bloco, por exemplo "=== BÍBLIA ===".
const BLOCK_HEADER = /^===.*===\s*$/;
const MARKER = /\{\{(\w+)\}\}/g;

// Monta a mensagem de abertura: preenche os marcadores e omite os blocos que ficaram vazios.
export function buildPack(template: string, sections: PackSections): string {
  const lines = messageLines(template);

  // Divide em blocos: o primeiro é o texto de abertura; cada "=== ... ===" começa um novo.
  const blocks: string[][] = [[]];
  for (const line of lines) {
    if (BLOCK_HEADER.test(line)) blocks.push([line]);
    else blocks.at(-1)?.push(line);
  }

  const kept = blocks
    .map((block) => block.join("\n"))
    .filter((text, index) => index === 0 || !hasEmptyMarker(text, sections))
    .map((text) => fillMarkers(text, sections));

  return `${kept.join("\n").trim()}\n`;
}

export function hasPackMarkers(template: string): boolean {
  return [...template.matchAll(MARKER)].some((m) => isKnownMarker(m[1]));
}

export function isGeneratedByPack(content: string): boolean {
  const withoutBom = content.startsWith("﻿") ? content.slice(1) : content;
  return withoutBom.startsWith(PACK_MARK_PREFIX);
}

function messageLines(template: string): string[] {
  const lines = template.split(/\r?\n/);
  const copyFrom = lines.findIndex((line) => COPY_FROM_LINE.test(line));
  return copyFrom === -1 ? lines : lines.slice(copyFrom + 1);
}

function hasEmptyMarker(text: string, sections: PackSections): boolean {
  return [...text.matchAll(MARKER)].some(
    (m) => isKnownMarker(m[1]) && sections[m[1]].trim() === "",
  );
}

function fillMarkers(text: string, sections: PackSections): string {
  // Marcador desconhecido fica como está, para o usuário perceber o erro de digitação.
  return text.replace(MARKER, (whole, name: string) =>
    isKnownMarker(name) ? sections[name].trim() : whole,
  );
}

function isKnownMarker(name: string | undefined): name is keyof PackSections {
  return PACK_MARKERS.some((marker) => marker === name);
}
