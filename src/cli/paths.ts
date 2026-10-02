import { fileURLToPath } from "node:url";

// src/cli/ (dev) e dist/cli/ (build) ficam dois níveis abaixo da raiz do pacote.
export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates", import.meta.url));

// Página do app (HTML, CSS e JS do navegador). Fica na raiz do pacote, como templates/.
export const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));

// Texto das instruções para a IA (CLAUDE.md e AGENTS.md) e o .claude/settings.json da história.
// Fora de templates/ porque o init grava com nomes próprios; e o nome não é CLAUDE.md para o
// Claude Code não carregar essas regras quando alguém trabalha neste repositório.
export const INSTRUCTIONS_DIR = fileURLToPath(new URL("../../instrucoes", import.meta.url));
