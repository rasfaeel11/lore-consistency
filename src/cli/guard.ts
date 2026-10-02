import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { compareHashes, diffLines, directChangesEntry, isProtectedPath, type Change } from "../core/guard.js";
import { isFile, readText } from "./story-files.js";

// Pasta do lore-pack dentro da história. Tem um .gitignore com "*", então fica fora do git.
const GUARD_DIR = ".lore-pack";
const MANIFEST = "manifest.json";

type Manifest = {
  criado_em: string;
  // caminho → sha256 do conteúdo
  arquivos: Record<string, string>;
};

export type GuardChange = Change & { diff: string };

export type GuardReport = {
  since: string;
  changes: GuardChange[];
};

export function hasSnapshot(root: string, id: string): boolean {
  return isFile(join(snapshotDir(root, id), MANIFEST));
}

// Copia os arquivos protegidos para .lore-pack/snapshots/<id>/arquivos/ e grava o hash de cada um.
// Um snapshot novo substitui o anterior da mesma sessão.
export function takeSnapshot(root: string, id: string, now = new Date()): string {
  const dir = snapshotDir(root, id);
  rmSync(dir, { recursive: true, force: true });

  const arquivos: Record<string, string> = {};
  for (const path of protectedPaths(root)) {
    const content = readFileSync(join(root, path));
    const target = join(dir, "arquivos", path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    arquivos[path] = hash(content);
  }

  mkdirSync(dir, { recursive: true });
  const manifest: Manifest = { criado_em: now.toISOString(), arquivos };
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  ensureLorePackDir(root);
  return manifest.criado_em;
}

// Cria .lore-pack/ com um .gitignore "*", que deixa a pasta fora do git sem mexer no .gitignore do autor.
export function ensureLorePackDir(root: string): string {
  const dir = join(root, GUARD_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "*\n");
  return dir;
}

// Compara o estado atual com o snapshot. Sem snapshot, undefined.
export function checkGuard(root: string, id: string): GuardReport | undefined {
  const manifest = readManifest(root, id);
  if (!manifest) return undefined;

  const current: Record<string, string> = {};
  for (const path of protectedPaths(root)) current[path] = hash(readFileSync(join(root, path)));

  const changes = compareHashes(manifest.arquivos, current).map((change) => {
    const before = change.kind === "criado" ? "" : readText(join(snapshotDir(root, id), "arquivos", change.path));
    const after = change.kind === "apagado" ? "" : readText(join(root, change.path));
    const diff = diffLines(before, after) || "(o texto é o mesmo; mudou só a quebra de linha ou a codificação)";
    return { ...change, diff };
  });
  return { since: manifest.criado_em, changes };
}

// Volta cada arquivo protegido ao que estava no snapshot: restaura alterados e apagados, apaga criados.
export function revertChanges(root: string, id: string): Change[] {
  const changes = requireReport(root, id).changes;
  for (const change of changes) {
    const target = join(root, change.path);
    if (change.kind === "criado") {
      rmSync(target);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(snapshotDir(root, id), "arquivos", change.path)));
    }
  }
  return changes.map(({ path, kind }) => ({ path, kind }));
}

// Registra as mudanças em sessoes/<id>/alteracoes-diretas.md e tira um snapshot novo,
// para elas não serem acusadas de novo.
export function keepChanges(root: string, id: string, now = new Date()): Change[] {
  const changes = requireReport(root, id).changes.map(({ path, kind }) => ({ path, kind }));
  if (changes.length === 0) return [];

  const log = join(root, "sessoes", id, "alteracoes-diretas.md");
  const prefix = existsSync(log)
    ? "\n"
    : "# Alterações diretas\n\nArquivos protegidos que mudaram fora do fechamento da sessão e que o autor decidiu manter.\n\n";
  appendFileSync(log, `${prefix}${directChangesEntry(changes, now.toISOString())}`);
  takeSnapshot(root, id, now);
  return changes;
}

// Texto para o terminal: lista, diff de cada arquivo e como resolver.
export function formatGuardReport(report: GuardReport, id: string): string {
  if (report.changes.length === 0) {
    return `Guarda do cânone: nenhum arquivo protegido mudou desde ${report.since}.\n`;
  }
  const count = report.changes.length === 1 ? "1 arquivo protegido mudou" : `${report.changes.length} arquivos protegidos mudaram`;
  const lines = [`!!! Guarda do cânone: ${count} desde ${report.since} !!!`, ""];
  for (const change of report.changes) lines.push(`  ${change.kind}: ${change.path}`);
  for (const change of report.changes) lines.push("", `--- ${change.path} (${change.kind})`, change.diff);
  lines.push(
    "",
    "Para desfazer tudo (volta ao snapshot):",
    `  lore-pack sessao verificar ${id} --reverter`,
    "Para manter e registrar em alteracoes-diretas.md:",
    `  lore-pack sessao verificar ${id} --manter`,
  );
  return `${lines.join("\n")}\n`;
}

function requireReport(root: string, id: string): GuardReport {
  const report = checkGuard(root, id);
  if (!report) throw new Error(`A sessão "${id}" não tem snapshot. Rode "lore-pack sessao verificar ${id} --vigiar" primeiro.`);
  return report;
}

function readManifest(root: string, id: string): Manifest | undefined {
  const path = join(snapshotDir(root, id), MANIFEST);
  if (!isFile(path)) return undefined;
  try {
    const manifest = JSON.parse(readText(path)) as Manifest;
    if (typeof manifest.criado_em !== "string" || typeof manifest.arquivos !== "object") throw new Error();
    return manifest;
  } catch {
    throw new Error(
      `O snapshot da sessão "${id}" está corrompido (${GUARD_DIR}/snapshots/${id}/${MANIFEST}). Rode "lore-pack sessao verificar ${id} --vigiar" para tirar um novo.`,
    );
  }
}

// Arquivos protegidos que existem agora, com caminho relativo usando "/".
function protectedPaths(root: string): string[] {
  const paths: string[] = [];
  for (const relative of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    const path = relative.split(sep).join("/");
    if (isProtectedPath(path) && statSync(join(root, relative)).isFile()) paths.push(path);
  }
  return paths.sort();
}

// Apaga o snapshot de uma sessão (usado quando a sessão é apagada).
export function removeSnapshot(root: string, id: string): void {
  rmSync(snapshotDir(root, id), { recursive: true, force: true });
}

function snapshotDir(root: string, id: string): string {
  return join(root, GUARD_DIR, "snapshots", id);
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
