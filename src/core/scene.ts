// Cenas são separadas por uma linha que contém só "***" (espaços em volta são aceitos).
const SCENE_SEPARATOR = /^\s*\*\*\*\s*$/;

// Devolve a última cena com texto. Sem separador, devolve o capítulo inteiro.
export function lastScene(chapter: string): string {
  const scenes: string[][] = [[]];
  for (const line of chapter.split(/\r?\n/)) {
    if (SCENE_SEPARATOR.test(line)) {
      scenes.push([]);
    } else {
      scenes.at(-1)?.push(line);
    }
  }

  const texts = scenes.map((lines) => lines.join("\n").trim());
  return texts.findLast((text) => text !== "") ?? "";
}

// Escolhe o capítulo mais recente pela ordem do nome do arquivo.
// A comparação numérica faz "cap-10" vir depois de "cap-2", mesmo sem zero à esquerda.
export function latestChapter(fileNames: string[]): string | undefined {
  const sorted = [...fileNames].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sorted.at(-1);
}
