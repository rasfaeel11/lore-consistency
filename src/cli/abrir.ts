import { parseArgs } from "node:util";
import { openFolder } from "./open-browser.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot } from "./story-files.js";

const USAGE = `Uso:
  lore-pack abrir [pasta]

Abre a pasta da história no gerenciador de arquivos do sistema (padrão: a pasta atual).

Opções:
  -h, --help   mostra esta ajuda
`;

// open abre a pasta; os testes passam uma função que só anota o caminho.
export function abrir(args: string[], open: (folder: string) => void = openFolder): CliResult {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { help: { type: "boolean", short: "h" } }, allowPositionals: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack abrir --help" para ver as opções.`);
  }
  if (parsed.values.help) return ok(USAGE);

  const story = findStoryRoot(parsed.positionals[0] ?? ".");
  if (!story.ok) return fail(story.error);
  open(story.root);
  return ok(`Pasta da história:\n  ${story.root}\nSe o gerenciador de arquivos não abrir sozinho, copie esse caminho.\n`);
}
