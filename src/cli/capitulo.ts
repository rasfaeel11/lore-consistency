import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { listChapters, nextChapterId } from "../core/chapters.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot, readStoryFiles } from "./story-files.js";

const USAGE = `Uso:
  lore-pack capitulo novo "<título>" [pasta]

Cria o próximo capítulo em capitulos/ (cap-01.md, cap-02.md...) com o título como cabeçalho.
`;

export function capitulo(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { help: { type: "boolean", short: "h" } }, allowPositionals: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack capitulo --help" para ver as opções.`);
  }

  const [subcommand, title, folder = "."] = parsed.positionals;
  if (parsed.values.help) return ok(USAGE);
  if (subcommand !== "novo") {
    return fail(`${subcommand ? `Subcomando desconhecido: "${subcommand}".\n\n` : ""}${USAGE}`);
  }
  if (!title || title.trim() === "") {
    return fail(`Informe o título do capítulo entre aspas, por exemplo: lore-pack capitulo novo "A tempestade"`);
  }

  const story = findStoryRoot(folder);
  if (!story.ok) return fail(story.error);

  const ids = listChapters(readStoryFiles(story.root)).map((chapter) => chapter.id);
  const id = nextChapterId(ids);
  mkdirSync(join(story.root, "capitulos"), { recursive: true });
  // "wx": falha se o arquivo já existir, em vez de sobrescrever.
  writeFileSync(join(story.root, "capitulos", `${id}.md`), `# ${title.trim()}\n`, { flag: "wx" });

  return ok(`Capítulo criado: capitulos/${id}.md ("${title.trim()}")\n`);
}
