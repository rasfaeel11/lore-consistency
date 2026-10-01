// Guarda do cânone: compara os arquivos protegidos com o snapshot tirado quando a sessão começou.
// Detecta depois do fato; não impede ninguém de escrever.

const PROTECTED_FILES = ["biblia.md", "estado.md", "alfabeto.md"];
const PROTECTED_DIRS = ["fichas/", "referencias/", "capitulos/"];
const CONTEXT_LINES = 2;

export type ChangeKind = "alterado" | "apagado" | "criado";

export type Change = {
  path: string;
  kind: ChangeKind;
};

// Caminho relativo à pasta da história, com "/". Tudo em sessoes/ fica livre (rascunho.md, fechamento.md).
export function isProtectedPath(path: string): boolean {
  return PROTECTED_FILES.includes(path) || PROTECTED_DIRS.some((dir) => path.startsWith(dir));
}

// Compara dois mapas caminho → hash.
export function compareHashes(before: Record<string, string>, after: Record<string, string>): Change[] {
  const changes: Change[] = [];
  for (const [path, hash] of Object.entries(before)) {
    if (!(path in after)) changes.push({ path, kind: "apagado" });
    else if (after[path] !== hash) changes.push({ path, kind: "alterado" });
  }
  for (const path of Object.keys(after)) {
    if (!(path in before)) changes.push({ path, kind: "criado" });
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

type DiffLine = { sign: " " | "-" | "+"; text: string };

// Diff linha a linha: "- " saiu, "+ " entrou, "  " igual. Longe das mudanças, as linhas iguais viram "…".
export function diffLines(before: string, after: string): string {
  const ops = lineOps(splitLines(before), splitLines(after));
  const changed = ops.map((op, i) => (op.sign === " " ? -1 : i)).filter((i) => i >= 0);
  if (changed.length === 0) return "";

  const near = (i: number) => changed.some((c) => Math.abs(c - i) <= CONTEXT_LINES);
  const output: string[] = [];
  let skipped = false;
  ops.forEach((op, i) => {
    if (!near(i)) {
      if (!skipped) output.push("…");
      skipped = true;
      return;
    }
    skipped = false;
    output.push(`${op.sign} ${op.text}`);
  });
  return output.join("\n");
}

// Texto da seção que o "Manter" acrescenta em sessoes/<id>/alteracoes-diretas.md.
export function directChangesEntry(changes: Change[], when: string): string {
  const list = changes.map((change) => `- ${change.kind}: ${change.path}`).join("\n");
  return `## ${when}\n\nO autor decidiu manter estas alterações feitas direto nos arquivos protegidos:\n\n${list}\n`;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

// Maior subsequência comum (LCS). O começo e o fim iguais são tirados antes,
// para a tabela ficar pequena no caso comum (poucas linhas mudadas num capítulo grande).
function lineOps(a: string[], b: string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  // lcs[i][j] = tamanho da LCS de midA[i..] e midB[j..].
  const lcs = Array.from({ length: midA.length + 1 }, () => new Array<number>(midB.length + 1).fill(0));
  for (let i = midA.length - 1; i >= 0; i--) {
    for (let j = midB.length - 1; j >= 0; j--) {
      lcs[i]![j] = midA[i] === midB[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const ops: DiffLine[] = a.slice(0, start).map((text) => ({ sign: " ", text }));
  let i = 0;
  let j = 0;
  while (i < midA.length || j < midB.length) {
    if (i < midA.length && j < midB.length && midA[i] === midB[j]) {
      ops.push({ sign: " ", text: midA[i]! });
      i++;
      j++;
    } else if (j >= midB.length || (i < midA.length && lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      ops.push({ sign: "-", text: midA[i]! });
      i++;
    } else {
      ops.push({ sign: "+", text: midB[j]! });
      j++;
    }
  }
  ops.push(...a.slice(endA).map((text): DiffLine => ({ sign: " ", text })));
  return ops;
}
