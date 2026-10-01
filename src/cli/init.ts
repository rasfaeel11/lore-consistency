import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, ok, type CliResult } from "./result.js";

// src/cli/init.ts (dev) e dist/cli/init.js (build) ficam dois níveis abaixo da raiz do pacote.
const TEMPLATES_DIR = fileURLToPath(new URL("../../templates", import.meta.url));

// Cria a pasta da história copiando templates/. Recusa pasta que já tenha conteúdo.
export function init(folder: string | undefined): CliResult {
  if (!folder) {
    return fail("Informe a pasta da história: lore-pack init <pasta>");
  }

  const target = resolve(folder);
  if (existsSync(target)) {
    if (!statSync(target).isDirectory()) {
      return fail(`"${folder}" já existe e não é uma pasta. Escolha outro nome.`);
    }
    if (readdirSync(target).length > 0) {
      return fail(
        `A pasta "${folder}" não está vazia. O init só cria a história numa pasta nova ou vazia, para não sobrescrever nada seu. Escolha outra pasta.`,
      );
    }
  }

  mkdirSync(target, { recursive: true });
  // .gitkeep só existe para o git guardar as pastas vazias do repositório; o usuário não precisa dele.
  cpSync(TEMPLATES_DIR, target, {
    recursive: true,
    filter: (source) => basename(source) !== ".gitkeep",
  });

  return ok(`História criada em ${target}

Próximos passos:
  1. Cole a sua bíblia em biblia.md.
  2. Crie as primeiras fichas em fichas/<tipo>/, copiando modelos/ficha-modelo.md.
  3. Rode "lore-pack check ${folder}" para validar as fichas.

O COMO-USAR.md explica o ritual de cada sessão de escrita.
`);
}
