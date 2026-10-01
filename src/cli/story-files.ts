import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import type { StoryFile } from "../core/validate.js";

// Lê um arquivo de texto sem o BOM e com quebras de linha "\n", igual em qualquer sistema.
export function readText(path: string): string {
  const text = readFileSync(path, "utf8");
  return (text.startsWith("﻿") ? text.slice(1) : text).replace(/\r\n/g, "\n");
}

// Lê só o que a validação usa: os .md da raiz e os .md dentro de fichas/, em ordem alfabética.
export function readStoryFiles(root: string): StoryFile[] {
  const files: StoryFile[] = [];
  for (const relative of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    // O núcleo espera caminhos com "/", mesmo no Windows.
    const path = relative.split(sep).join("/");
    const isRootFile = !path.includes("/");
    if (!path.endsWith(".md") || !(isRootFile || path.startsWith("fichas/"))) continue;

    const fullPath = join(root, relative);
    if (!statSync(fullPath).isFile()) continue;
    files.push({ path, content: readText(fullPath) });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
