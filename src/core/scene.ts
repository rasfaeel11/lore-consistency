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

