import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { diffLines } from "../core/guard.js";
import { ensureLorePackDir } from "./guard.js";
import { INSTRUCTIONS_DIR } from "./paths.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot, isFile, readText } from "./story-files.js";

const USAGE = `Uso:
  lore-pack atualizar-instrucoes [pasta] [--sobrescrever]

Grava (ou atualiza) as instruções para a IA na pasta da história: CLAUDE.md e AGENTS.md
(mesmo texto) e .claude/settings.json (proíbe o Claude Code de editar os arquivos protegidos).
Serve para pastas criadas antes destes arquivos existirem, ou depois de atualizar o lore-pack.

Se você editou algum desses arquivos, o comando mostra a diferença e não grava nada.

Opções:
  --sobrescrever   troca também os arquivos que você editou
  -h, --help       mostra esta ajuda
`;

// Onde o lore-pack guarda o hash do que ele mesmo gravou, para saber se o autor editou depois.
const HASHES_FILE = "instrucoes.json";

type Generated = { path: string; content: string };

// Os três arquivos que o lore-pack gera na pasta da história.
export function instructionFiles(): Generated[] {
  const text = readText(join(INSTRUCTIONS_DIR, "instrucoes-ia.md"));
  return [
    { path: "CLAUDE.md", content: text },
    { path: "AGENTS.md", content: text },
    { path: ".claude/settings.json", content: readText(join(INSTRUCTIONS_DIR, "claude-settings.json")) },
  ];
}

// Usado pelo init: a pasta acabou de ser criada, não há o que perguntar.
export function writeInstructions(root: string): void {
  const files = instructionFiles();
  for (const file of files) writeGenerated(root, file);
  saveHashes(root, files);
}

type Plan = Generated & { action: "criado" | "igual" | "atualizado" | "editado"; diff: string };

export function atualizarInstrucoes(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { sobrescrever: { type: "boolean" }, help: { type: "boolean", short: "h" } },
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack atualizar-instrucoes --help" para ver as opções.`);
  }
  if (parsed.values.help) return ok(USAGE);

  const story = findStoryRoot(parsed.positionals[0] ?? ".");
  if (!story.ok) return fail(story.error);
  const root = story.root;

  // Decide tudo antes de gravar: com um arquivo editado e sem --sobrescrever, nada muda.
  const stored = readHashes(root);
  const plans: Plan[] = instructionFiles().map((file) => planFor(root, file, stored[file.path]));
  const edited = plans.filter((plan) => plan.action === "editado");
  if (edited.length > 0 && !parsed.values.sobrescrever) {
    const lines = ["Você editou estes arquivos depois que o lore-pack os gerou:", ""];
    for (const plan of edited) {
      lines.push(`--- ${plan.path} ("-" é o seu texto, "+" é o texto novo do lore-pack)`, plan.diff, "");
    }
    lines.push(
      "Para não perder o que você escreveu, nada foi gravado.",
      `Se quiser trocar mesmo assim: lore-pack atualizar-instrucoes --sobrescrever`,
    );
    return fail(`${lines.join("\n")}`);
  }

  const changed = plans.filter((plan) => plan.action !== "igual");
  for (const plan of changed) writeGenerated(root, plan);
  saveHashes(root, plans);

  if (changed.length === 0) return ok("As instruções para a IA já estão atualizados (CLAUDE.md, AGENTS.md e .claude/settings.json).\n");
  const label = { criado: "criado", atualizado: "atualizado", editado: "sobrescrito", igual: "igual" };
  const report = changed.map((plan) => `  ${label[plan.action]}: ${plan.path}`).join("\n");
  return ok(`Instruções para a IA gravadas:\n${report}\n`);
}

function planFor(root: string, file: Generated, storedHash: string | undefined): Plan {
  const target = join(root, file.path);
  if (!isFile(target)) return { ...file, action: "criado", diff: "" };
  const current = readText(target);
  if (current === file.content) return { ...file, action: "igual", diff: "" };
  // O arquivo ainda é o que o lore-pack gravou da última vez: o autor não mexeu.
  if (storedHash === hash(current)) return { ...file, action: "atualizado", diff: "" };
  return { ...file, action: "editado", diff: diffLines(current, file.content) };
}

function writeGenerated(root: string, file: Generated): void {
  const target = join(root, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content);
}

function readHashes(root: string): Record<string, string> {
  const path = join(root, ".lore-pack", HASHES_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  } catch {
    // Registro quebrado: trata tudo como possivelmente editado (pergunta antes de trocar).
    return {};
  }
}

function saveHashes(root: string, files: Generated[]): void {
  const hashes = Object.fromEntries(files.map((file) => [file.path, hash(file.content)]));
  writeFileSync(join(ensureLorePackDir(root), HASHES_FILE), `${JSON.stringify(hashes, null, 2)}\n`);
}

// Hash do texto já normalizado (sem BOM, com "\n"): trocar a quebra de linha não conta como edição.
function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
