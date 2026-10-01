import { stringify } from "yaml";
import { z } from "zod";
import { CHAPTER_ID, chapterNumber } from "./chapters.js";
import { splitFrontmatter } from "./frontmatter.js";
import type { StoryFile } from "./validate.js";

export const SESSION_STATUS = ["aberta", "fechada"] as const;

// data-capítulo-sequência, por exemplo 2026-10-01-cap-03-01.
const SESSION_ID = /^(\d{4}-\d{2}-\d{2})-(cap-\d+)-(\d+)$/;
const SESSION_PATH = /^sessoes\/([^/]+)\/sessao\.md$/;
// Data e hora ISO com fuso: 2026-10-01T12:00:00.000Z ou 2026-10-01T09:00:00-03:00.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function missing(field: string): string {
  return `Campo obrigatório "${field}" ausente. Adicione a linha "${field}: ..." no cabeçalho.`;
}

function isoDateTime(field: string) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? missing(field) : `"${field}" precisa ser um texto.`) })
    .refine((value) => ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value)), {
      error: `"${field}" precisa ser data e hora no formato ISO, por exemplo: 2026-10-01T14:30:00.000Z`,
    });
}

export const sessionSchema = z
  .object({
    id: z
      .string({ error: (issue) => (issue.input === undefined ? missing("id") : '"id" precisa ser um texto.') })
      .regex(SESSION_ID, {
        error: (issue) =>
          `O id "${String(issue.input)}" é inválido. Use data-capítulo-sequência, por exemplo: 2026-10-01-cap-03-01.`,
      }),
    capitulo: z
      .string({
        error: (issue) => (issue.input === undefined ? missing("capitulo") : '"capitulo" precisa ser um texto.'),
      })
      .regex(CHAPTER_ID, {
        error: (issue) => `O capítulo "${String(issue.input)}" é inválido. Use o nome do arquivo sem .md, por exemplo: cap-03.`,
      }),
    criada_em: isoDateTime("criada_em"),
    status: z.enum(SESSION_STATUS, {
      error: (issue) =>
        issue.input === undefined
          ? missing("status")
          : `O status "${String(issue.input)}" não existe. Use um de: ${SESSION_STATUS.join(", ")}.`,
    }),
    fechada_em: isoDateTime("fechada_em").optional(),
  })
  .refine((session) => session.status !== "fechada" || session.fechada_em !== undefined, {
    error: 'Sessão fechada precisa de "fechada_em". Adicione a data e hora em que ela foi fechada.',
    path: ["fechada_em"],
  });

export type Session = z.infer<typeof sessionSchema>;

export type SessionGroup = {
  capitulo: string;
  sessions: Session[];
};

// Nome da pasta da sessão, se o caminho for sessoes/<pasta>/sessao.md.
export function sessionFolder(path: string): string | undefined {
  return SESSION_PATH.exec(path)?.[1];
}

export function isSessionId(id: string): boolean {
  return SESSION_ID.test(id);
}

export type ReadSessionResult = { ok: true; session: Session; body: string } | { ok: false; error: string };

// Lê um sessao.md: cabeçalho validado e corpo (plano e resumo).
export function readSession(content: string): ReadSessionResult {
  const split = splitFrontmatter(content);
  if (!split.ok) return { ok: false, error: split.error };
  const parsed = sessionSchema.safeParse(split.data);
  if (!parsed.success) {
    return { ok: false, error: 'O cabeçalho da sessão é inválido. Rode "lore-pack check" para ver o problema.' };
  }
  return { ok: true, session: parsed.data, body: split.body };
}

// Sessões válidas agrupadas por capítulo, capítulos em ordem numérica e sessões em ordem de id.
// Sessões com cabeçalho inválido ficam de fora: o check acusa.
export function listSessions(files: StoryFile[]): SessionGroup[] {
  const groups = new Map<string, Session[]>();
  for (const file of files) {
    if (!sessionFolder(file.path)) continue;
    const split = splitFrontmatter(file.content);
    if (!split.ok) continue;
    const parsed = sessionSchema.safeParse(split.data);
    if (!parsed.success) continue;

    const list = groups.get(parsed.data.capitulo) ?? [];
    list.push(parsed.data);
    groups.set(parsed.data.capitulo, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => chapterNumber(a) - chapterNumber(b))
    .map(([capitulo, sessions]) => ({
      capitulo,
      sessions: sessions.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    }));
}

// A sequência conta as sessões do capítulo em todos os dias. A data é a local de "now".
export function nextSessionId(capitulo: string, existingIds: string[], now: Date): string {
  let highest = 0;
  for (const id of existingIds) {
    const match = SESSION_ID.exec(id);
    if (match?.[2] === capitulo) highest = Math.max(highest, Number(match[3]));
  }
  return `${localDate(now)}-${capitulo}-${String(highest + 1).padStart(2, "0")}`;
}

export function newSessionFile(input: { id: string; capitulo: string; criada_em: string; plano: string }): string {
  const header = { id: input.id, capitulo: input.capitulo, criada_em: input.criada_em, status: "aberta" };
  return `---\n${stringify(header)}---\n## Plano\n\n${input.plano.trim()}\n`;
}

export type CloseResult = { ok: true; content: string } | { ok: false; error: string };

// Marca a sessão como fechada e, se vier resumo, acrescenta a seção "## Resumo" no fim.
// Campos extras que o usuário tenha posto no cabeçalho são mantidos.
export function closeSession(content: string, fechadaEm: string, resumo?: string): CloseResult {
  const split = splitFrontmatter(content);
  if (!split.ok) return { ok: false, error: split.error };
  const parsed = sessionSchema.safeParse(split.data);
  if (!parsed.success) {
    return { ok: false, error: 'O cabeçalho da sessão é inválido. Rode "lore-pack check" para ver o problema.' };
  }
  if (parsed.data.status === "fechada") {
    return {
      ok: false,
      error: `A sessão "${parsed.data.id}" já está fechada (desde ${parsed.data.fechada_em}). Nada foi alterado.`,
    };
  }

  const header = { ...split.data, status: "fechada", fechada_em: fechadaEm };
  let body = split.body;
  if (resumo && resumo.trim() !== "") body = `${body.trimEnd()}\n\n## Resumo\n\n${resumo.trim()}\n`;
  return { ok: true, content: `---\n${stringify(header)}---\n${body}` };
}

// Instrução curta que inicia a IA. O caminho é relativo à pasta da história.
export function buildStartPrompt(packPath: string): string {
  return `Leia o arquivo ${packPath} e siga as instruções dele.`;
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
