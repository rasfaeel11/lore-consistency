import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { chapterFileName } from "../core/chapters.js";
import { sessionFolder } from "../core/session.js";
import type { StoryFile } from "../core/validate.js";

// Lê um arquivo de texto sem o BOM e com quebras de linha "\n", igual em qualquer sistema.
export function readText(path: string): string {
  const text = readFileSync(path, "utf8");
  return (text.startsWith("﻿") ? text.slice(1) : text).replace(/\r\n/g, "\n");
}

// Lê só o que a validação usa, em ordem alfabética: os .md da raiz, os .md dentro de fichas/
// e de referencias/, os capítulos (capitulos/*.md) e o sessao.md de cada sessão.
export function readStoryFiles(root: string): StoryFile[] {
  const files: StoryFile[] = [];
  for (const relative of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    // O núcleo espera caminhos com "/", mesmo no Windows.
    const path = relative.split(sep).join("/");
    if (!path.endsWith(".md") || !isStoryPath(path)) continue;

    const fullPath = join(root, relative);
    if (!statSync(fullPath).isFile()) continue;
    files.push({ path, content: readText(fullPath) });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function isStoryPath(path: string): boolean {
  const isRootFile = !path.includes("/");
  return (
    isRootFile ||
    path.startsWith("fichas/") ||
    path.startsWith("referencias/") ||
    chapterFileName(path) !== undefined ||
    sessionFolder(path) !== undefined
  );
}

// Confere se a pasta existe e tem biblia.md. Devolve o caminho absoluto ou a mensagem de erro.
export function findStoryRoot(folder: string): { ok: true; root: string } | { ok: false; error: string } {
  const root = resolve(folder);
  if (!isDirectory(root)) {
    return {
      ok: false,
      error: `A pasta "${folder}" não existe. Confira o caminho ou crie uma história com "lore-pack init <pasta>".`,
    };
  }
  if (!isFile(join(root, "biblia.md"))) {
    return {
      ok: false,
      error: `A pasta "${folder}" não parece uma pasta de história: não tem biblia.md. Rode o comando dentro da pasta da história ou passe o caminho dela.`,
    };
  }
  return { ok: true, root };
}

export function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}
