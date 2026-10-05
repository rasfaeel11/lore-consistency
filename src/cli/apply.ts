import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  applyChanges,
  buildFixPrompt,
  extractChanges,
  isAllowedTarget,
  previewChanges,
  type Operation,
  type PreviewItem,
} from "../core/changes.js";
import { isSessionId, readSession } from "../core/session.js";
import { validateStory } from "../core/validate.js";
import { formatReport } from "./check.js";
import { checkGuard, formatGuardReport, hasSnapshot, takeSnapshot } from "./guard.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot, isFile, readStoryFiles, readText } from "./story-files.js";

const USAGE = `Uso:
  lore-pack apply <id-da-sessão> [pasta]                    mostra as mudanças, sem gravar nada
  lore-pack apply <id-da-sessão> --aplicar 1,3 [pasta]      grava só as operações 1 e 3
  lore-pack apply <id-da-sessão> --aplicar todas [pasta]    grava todas as que faltam

Lê sessoes/<id>/fechamento.md (a resposta do prompt 04-fechar-sessao) e mostra cada mudança
proposta, numerada, com o diff. Sem --aplicar, nada é gravado: a flag é a sua confirmação.

Só altera estado.md, alfabeto.md e fichas. Se uma das operações escolhidas não puder ser
aplicada, nenhuma é gravada. O que já foi aplicado fica anotado em sessoes/<id>/aplicado.json,
então rodar de novo não repete nada. Depois de aplicar, mostra o resultado do check.

Opções:
  --aplicar <números|todas>   números da lista, separados por vírgula, ou "todas"
  -h, --help                  mostra esta ajuda
`;

// Registro do que já foi aplicado, em sessoes/<id>/aplicado.json. Vale para um fechamento.md
// específico (o hash): se o arquivo mudar, é tratado como um fechamento novo.
const APPLIED_FILE = "aplicado.json";
type AppliedRecord = { fechamento_sha256: string; aplicado_em: string; indices: number[] };

export type ClosingItem = PreviewItem & { applied: boolean };

export type Closing =
  // replaced: havia um aplicado.json de outro texto de fechamento, que deixou de valer.
  | { ok: true; items: ClosingItem[]; replaced: boolean }
  | { ok: false; error: string; fixPrompt?: string };

type Loaded = { ok: true; items: ClosingItem[]; replaced: boolean; operations: Operation[]; hash: string; applied: number[] };

// Lê o fechamento da sessão e diz o que cada operação faria. Não grava nada.
export function readClosing(root: string, id: string): Closing {
  const loaded = loadClosing(root, id);
  return loaded.ok ? { ok: true, items: loaded.items, replaced: loaded.replaced } : loaded;
}

function loadClosing(root: string, id: string): Loaded | Extract<Closing, { ok: false }> {
  if (!isSessionId(id) || !isFile(join(root, "sessoes", id, "sessao.md"))) {
    return { ok: false, error: `A sessão "${id}" não existe em sessoes/. Rode "lore-pack sessao listar" para ver os ids.` };
  }
  const closingPath = `sessoes/${id}/fechamento.md`;
  if (!isFile(join(root, closingPath))) {
    return { ok: false, error: `${closingPath} não existe. Salve nesse arquivo a resposta da IA ao prompt 04-fechar-sessao e rode de novo.` };
  }

  const text = readText(join(root, closingPath));
  const extracted = extractChanges(text);
  if (!extracted.ok) return { ok: false, error: `${closingPath}: ${extracted.error}`, fixPrompt: buildFixPrompt(extracted.error) };

  // Com alteração direta não resolvida, o apply não roda: o snapshot novo que ele tira
  // no fim faria essa alteração deixar de ser acusada. Igual ao "sessao fechar".
  const guard = checkGuard(root, id);
  if (guard && guard.changes.length > 0) {
    return { ok: false, error: `${formatGuardReport(guard, id)}\nResolva as alterações acima antes de aplicar o fechamento. Nada foi alterado.` };
  }

  const hash = createHash("sha256").update(text).digest("hex");
  const record = readApplied(root, id);
  const applied = record?.fechamento_sha256 === hash ? record.indices : [];

  // As já aplicadas ficam fora da conta: os arquivos já têm o resultado delas.
  const { operations } = extracted;
  const pending = operations.map((_, position) => position + 1).filter((index) => !applied.includes(index));
  const previews = previewChanges(pending.flatMap((index) => operations[index - 1] ?? []), readStoryFiles(root));
  const items = operations.map((operation, position): ClosingItem => {
    const index = position + 1;
    const preview = previews[pending.indexOf(index)];
    if (preview) return { ...preview, index, applied: false };
    // Já aplicada: só o título, sem diff.
    const [summary] = previewChanges([operation], []);
    return { index, op: operation.op, title: summary?.title ?? operation.op, path: null, kind: "alterado", diff: "", applied: true };
  });
  return { ok: true, items, replaced: record !== undefined && record.fechamento_sha256 !== hash, operations, hash, applied };
}

export type ApplyClosingResult =
  | { ok: true; applied: number[]; written: string[]; report: string; hasErrors: boolean }
  | { ok: false; error: string; fixPrompt?: string };

// Aplica as operações escolhidas (pelos números da lista, ou "todas" as que faltam). Tudo ou nada.
// Quem chama já tem a confirmação do autor (princípio 4): a flag --aplicar ou o segundo clique no app.
export function applyClosing(root: string, id: string, indices: number[] | "todas"): ApplyClosingResult {
  const loaded = loadClosing(root, id);
  if (!loaded.ok) return loaded;

  const available = loaded.items.filter((item) => !item.applied && item.kind !== "informativo" && item.error === undefined);
  const chosen = indices === "todas" ? available.map((item) => item.index) : [...new Set(indices)].sort((a, b) => a - b);
  if (chosen.length === 0) return { ok: false, error: "Não há nenhuma operação para aplicar. Nada foi alterado." };

  const problems: string[] = [];
  for (const index of chosen) {
    const item = loaded.items.find((candidate) => candidate.index === index);
    if (!item) problems.push(`A operação ${index} não existe: o fechamento tem ${loaded.items.length}.`);
    else if (item.applied) problems.push(`A operação ${index} já foi aplicada.`);
    else if (item.kind === "informativo") problems.push(`A operação ${index} é só informativa (não aprovado) e nunca é aplicada.`);
    else if (item.error !== undefined) problems.push(`A operação ${index} não pode ser aplicada: ${item.error}`);
  }
  if (problems.length > 0) return { ok: false, error: `${problems.join("\n")}\nNada foi alterado.` };

  const result = applyChanges(chosen.flatMap((index) => loaded.operations[index - 1] ?? []), readStoryFiles(root));
  if (!result.ok) return { ok: false, error: `${result.error}\nNada foi alterado.` };

  // Confere todos os caminhos antes de gravar o primeiro arquivo.
  for (const { path } of result.changed) {
    if (!isAllowedTarget(path) || relative(root, resolve(root, path)).startsWith("..")) {
      throw new Error(`O apply não pode gravar em "${path}". Só estado.md, alfabeto.md e fichas.`);
    }
  }
  for (const { path, content } of result.changed) {
    const target = join(root, path);
    // Arquivo que já usava quebra de linha do Windows continua usando (senão o git mostraria o arquivo inteiro mudado).
    const windowsLines = isFile(target) && readFileSync(target, "utf8").includes("\r\n");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, windowsLines ? content.replace(/\n/g, "\r\n") : content);
  }

  // Snapshot novo, para a guarda não acusar o que o próprio autor aprovou. Sessão sem snapshot continua sem.
  if (hasSnapshot(root, id)) takeSnapshot(root, id);
  const record: AppliedRecord = {
    fechamento_sha256: loaded.hash,
    aplicado_em: new Date().toISOString(),
    indices: [...loaded.applied, ...chosen].sort((a, b) => a - b),
  };
  writeFileSync(join(root, "sessoes", id, APPLIED_FILE), `${JSON.stringify(record, null, 2)}\n`);

  const files = readStoryFiles(root);
  const found = validateStory(files);
  return {
    ok: true,
    applied: chosen,
    written: result.changed.map((file) => file.path),
    report: formatReport(found, files),
    hasErrors: found.some((problem) => problem.severity === "erro"),
  };
}

// Registro ilegível conta como "nada aplicado": as linhas repetidas ainda são recusadas pelo núcleo.
function readApplied(root: string, id: string): AppliedRecord | undefined {
  const path = join(root, "sessoes", id, APPLIED_FILE);
  if (!isFile(path)) return undefined;
  try {
    const record = JSON.parse(readText(path)) as AppliedRecord;
    const valid = typeof record.fechamento_sha256 === "string" && Array.isArray(record.indices) && record.indices.every(Number.isInteger);
    return valid ? record : undefined;
  } catch {
    return undefined;
  }
}

export function apply(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { aplicar: { type: "string" }, help: { type: "boolean", short: "h" } },
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack apply --help" para ver as opções.`);
  }
  if (parsed.values.help) return ok(USAGE);

  const [id, folder = "."] = parsed.positionals;
  if (!id) return fail(`Informe o id da sessão, por exemplo: lore-pack apply 2026-10-01-cap-03-01`);

  const choice = parsed.values.aplicar;
  let indices: number[] | "todas" | undefined;
  if (choice !== undefined) {
    if (choice.trim() === "todas") indices = "todas";
    else if (/^\s*[1-9]\d*(\s*,\s*[1-9]\d*)*\s*$/.test(choice)) indices = choice.split(",").map(Number);
    else return fail(`--aplicar precisa dos números da lista separados por vírgula, ou "todas". Exemplos: --aplicar 1,3 ou --aplicar todas`);
  }

  const story = findStoryRoot(folder);
  if (!story.ok) return fail(story.error);
  const { root } = story;

  if (indices === undefined) {
    const closing = readClosing(root, id);
    return closing.ok ? ok(formatClosing(closing, id)) : fail(withFixPrompt(closing, id));
  }

  // Rodar com --aplicar é a confirmação do princípio 4.
  const applied = applyClosing(root, id, indices);
  if (!applied.ok) return fail(withFixPrompt(applied, id));

  const count = applied.applied.length === 1 ? "1 operação aplicada" : `${applied.applied.length} operações aplicadas`;
  const lines = [
    `${count} (${applied.applied.join(", ")}). Arquivos gravados:`,
    ...applied.written.map((path) => `  ${path}`),
    "",
    "Check depois de aplicar:",
    applied.report.trimEnd(),
  ];
  const left = readClosing(root, id);
  const pending = left.ok ? left.items.filter((item) => !item.applied && item.kind !== "informativo").map((item) => item.index) : [];
  if (pending.length > 0) lines.push("", `Ainda não aplicadas: ${pending.join(", ")}. Rode "lore-pack apply ${id}" para ver.`);
  const session = readSession(readText(join(root, "sessoes", id, "sessao.md")));
  if (session.ok && session.session.status === "aberta") lines.push("", `Para fechar a sessão: lore-pack sessao fechar ${id}`);
  return ok(`${lines.join("\n")}\n`);
}

function withFixPrompt(result: { error: string; fixPrompt?: string }, id: string): string {
  if (!result.fixPrompt) return result.error;
  return `${result.error}\n\nNada foi alterado. Para a IA corrigir, cole isto na conversa e ponha a resposta no sessoes/${id}/fechamento.md:\n\n${result.fixPrompt}`;
}

// A lista numerada, com o diff de cada operação e como aplicar.
function formatClosing(closing: Extract<Closing, { ok: true }>, id: string): string {
  const { items } = closing;
  if (items.length === 0) return `O sessoes/${id}/fechamento.md não traz nenhuma operação. Não há nada para aplicar.\n`;

  const lines = [`Fechamento da sessão ${id}: ${items.length === 1 ? "1 operação" : `${items.length} operações`}.`];
  if (closing.replaced) {
    lines.push("Atenção: o fechamento.md mudou desde a última vez que algo foi aplicado. Ele está sendo tratado como um fechamento novo.");
  }
  for (const item of items) {
    lines.push("", `[${item.index}] ${item.title}${item.applied ? " (já aplicada)" : ""}`);
    if (item.applied) continue;
    if (item.error !== undefined) lines.push(`    Não dá para aplicar: ${item.error}`);
    else if (item.kind === "informativo") lines.push(item.diff);
    else lines.push(`    ${item.kind === "criado" ? "arquivo novo" : "arquivo"}: ${item.path}`, item.diff);
  }

  const available = items.filter((item) => !item.applied && item.kind !== "informativo" && item.error === undefined);
  lines.push("");
  if (available.length === 0) {
    lines.push("Não há nenhuma operação para aplicar.");
  } else {
    const example = available.slice(0, 2).map((item) => item.index).join(",");
    lines.push(
      "Nada foi gravado. Para aplicar, escolha pelos números:",
      `  lore-pack apply ${id} --aplicar ${example}`,
      `  lore-pack apply ${id} --aplicar todas`,
    );
  }
  return `${lines.join("\n")}\n`;
}
