import { lastScene } from "./scene.js";
import type { StoryFile } from "./validate.js";

// Capítulos ficam em capitulos/cap-NN.md. O número pode ter mais dígitos (cap-100).
export const CHAPTER_ID = /^cap-\d+$/;
const CHAPTER_PATH = /^capitulos\/([^/]+)\.md$/;
const TITLE_LINE = /^# (.+)$/m;

export type Chapter = {
  id: string;
  path: string;
  title: string;
};

// Nome do arquivo sem .md, se o caminho for um arquivo direto de capitulos/.
export function chapterFileName(path: string): string | undefined {
  return CHAPTER_PATH.exec(path)?.[1];
}

export function chapterNumber(id: string): number {
  return Number(id.slice("cap-".length));
}

// Capítulos com nome no padrão cap-NN, em ordem numérica (cap-10 depois de cap-9).
// Arquivos fora do padrão ficam de fora: o check acusa.
export function listChapters(files: StoryFile[]): Chapter[] {
  const chapters: Chapter[] = [];
  for (const file of files) {
    const id = chapterFileName(file.path);
    if (!id || !CHAPTER_ID.test(id)) continue;
    const title = TITLE_LINE.exec(file.content)?.[1]?.trim() || id;
    chapters.push({ id, path: file.path, title });
  }
  return chapters.sort((a, b) => chapterNumber(a.id) - chapterNumber(b.id));
}

export function nextChapterId(existingIds: string[]): string {
  const highest = Math.max(0, ...existingIds.map(chapterNumber));
  return `cap-${String(highest + 1).padStart(2, "0")}`;
}

// Capítulo de onde sai a última cena do pacote: o pedido (ou o mais recente),
// voltando para os anteriores enquanto o capítulo só tiver o título.
export function chapterForScene(files: StoryFile[], upTo?: string): string | undefined {
  let chapters = listChapters(files);
  if (upTo) chapters = chapters.filter((c) => chapterNumber(c.id) <= chapterNumber(upTo));

  for (const chapter of chapters.toReversed()) {
    const content = files.find((f) => f.path === chapter.path)?.content ?? "";
    // Tira só o primeiro "# título"; se não sobrar texto, o capítulo ainda não tem cena.
    if (lastScene(content.replace(TITLE_LINE, "")) !== "") return chapter.path;
  }
  return undefined;
}
