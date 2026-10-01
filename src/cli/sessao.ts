import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { listChapters } from "../core/chapters.js";
import {
  buildStartPrompt,
  closeSession,
  listSessions,
  newSessionFile,
  nextSessionId,
} from "../core/session.js";
import { validateStory } from "../core/validate.js";
import { formatReport } from "./check.js";
import { PACK_OPTIONS, readPackOptions, writePack, type PackOptions } from "./pack.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot, isDirectory, isFile, readStoryFiles, readText } from "./story-files.js";

const USAGE = `Uso:
  lore-pack sessao nova --capitulo <cap-NN> --plano <plano.md> [opções do pack] [pasta]
  lore-pack sessao listar [pasta]
  lore-pack sessao fechar <id> [--fechamento <arquivo.md>] [--resumo "<texto>"] [pasta]

nova     cria sessoes/<id>/ com o sessao.md e o pacote.md, e mostra como iniciar a IA
listar   mostra os capítulos e as sessões de cada um, com o status
fechar   marca a sessão como fechada e guarda o fechamento em sessoes/<id>/fechamento.md

Opções do pack (para "nova"): --com, --ref, --sem, --alfabeto, --sem-ultima-cena, --limite.
Veja "lore-pack pack --help".
`;

export function sessao(args: string[]): CliResult {
  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "nova":
      return newSession(rest);
    case "listar":
      return listCommand(rest);
    case "fechar":
      return closeCommand(rest);
    case undefined:
    case "-h":
    case "--help":
      return ok(USAGE);
    default:
      return fail(`Subcomando desconhecido: "${subcommand}".\n\n${USAGE}`);
  }
}

function newSession(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { capitulo: { type: "string" }, plano: { type: "string" }, ...PACK_OPTIONS },
      allowPositionals: true,
    });
  } catch (error) {
    return argsError(error);
  }
  const options = parsed.values;
  if (!options.capitulo) return fail(`Informe o capítulo com --capitulo, por exemplo: --capitulo cap-03`);
  if (!options.plano) return fail(`Informe o plano da cena com --plano, por exemplo: --plano plano.md`);

  const common = readPackOptions(options);
  if (!common.ok) return fail(common.error);

  const story = findStoryRoot(parsed.positionals[0] ?? ".");
  if (!story.ok) return fail(story.error);
  const { root } = story;

  const planPath = resolve(options.plano);
  if (!isFile(planPath)) {
    return fail(`O plano "${options.plano}" não existe. Confira o caminho do --plano.`);
  }

  const created = createSession({ ...common.options, root, capitulo: options.capitulo, plan: readText(planPath) });
  if (!created.ok) return fail(created.error);

  const packPath = `sessoes/${created.id}/pacote.md`;
  return ok(`Sessão ${created.id} criada em sessoes/${created.id}/

${created.summary}
Para começar no Claude Code, abra o terminal na pasta da história e rode:
  cd "${root}"
  claude "${buildStartPrompt(packPath)}"

Com outra IA, cole o conteúdo de ${packPath} na conversa.
`);
}

export type NewSessionRequest = PackOptions & {
  root: string;
  capitulo: string;
  plan: string;
};

export type NewSessionResult = { ok: true; id: string; summary: string } | { ok: false; error: string };

// Cria sessoes/<id>/ com o sessao.md e o pacote.md. Usado pelo "sessao nova" e pelo app.
// Quem chama já conferiu que a pasta é uma história.
export function createSession(request: NewSessionRequest): NewSessionResult {
  const { root, capitulo } = request;
  const files = readStoryFiles(root);
  const chapterIds = listChapters(files).map((chapter) => chapter.id);
  if (!chapterIds.includes(capitulo)) {
    const available = chapterIds.length > 0 ? `Capítulos existentes: ${chapterIds.join(", ")}.` : "Ainda não há capítulos.";
    return {
      ok: false,
      error: `O capítulo "${capitulo}" não existe em capitulos/. ${available}\nUse um deles ou crie um novo com: lore-pack capitulo novo "<título>"`,
    };
  }

  // Com erro na pasta, nem cria a sessão (o pack recusaria do mesmo jeito).
  const problems = validateStory(files);
  if (problems.some((problem) => problem.severity === "erro")) {
    return { ok: false, error: `${formatReport(problems, files)}\nCorrija os erros acima antes de abrir uma sessão.` };
  }

  // Conta todas as pastas de sessoes/, mesmo as inválidas, para nunca reusar um nome.
  const sessionsDir = join(root, "sessoes");
  const existing = isDirectory(sessionsDir) ? readdirSync(sessionsDir) : [];
  const now = new Date();
  const id = nextSessionId(capitulo, existing, now);
  const folder = join(sessionsDir, id);

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "sessao.md"), newSessionFile({ id, capitulo, criada_em: now.toISOString(), plano: request.plan }));
  const packResult = writePack({ ...request, output: join(folder, "pacote.md"), chapter: capitulo });
  if (packResult.exitCode !== 0) {
    // A pasta acabou de ser criada por nós: apagar não perde nada do usuário.
    rmSync(folder, { recursive: true, force: true });
    return { ok: false, error: packResult.stderr.trimEnd() };
  }
  return { ok: true, id, summary: packResult.stdout };
}

function listCommand(args: string[]): CliResult {
  const story = findStoryRoot(args[0] ?? ".");
  if (!story.ok) return fail(story.error);

  const files = readStoryFiles(story.root);
  const chapters = listChapters(files);
  const groups = listSessions(files);
  if (chapters.length === 0 && groups.length === 0) {
    return ok(`Nenhum capítulo em capitulos/. Crie o primeiro com: lore-pack capitulo novo "<título>"\n`);
  }

  const lines: string[] = [];
  const idWidth = Math.max(0, ...chapters.map((c) => c.id.length), ...groups.map((g) => g.capitulo.length));
  const printGroup = (heading: string, capitulo: string) => {
    lines.push(heading);
    const sessions = groups.find((g) => g.capitulo === capitulo)?.sessions ?? [];
    if (sessions.length === 0) lines.push("  nenhuma sessão");
    for (const session of sessions) lines.push(`  ${session.id}  ${session.status}`);
    lines.push("");
  };

  for (const chapter of chapters) printGroup(`${chapter.id.padEnd(idWidth)}  ${chapter.title}`, chapter.id);
  // Sessões de capítulos que não existem: o check acusa, mas elas aparecem para não sumirem.
  for (const group of groups.filter((g) => !chapters.some((c) => c.id === g.capitulo))) {
    printGroup(`${group.capitulo.padEnd(idWidth)}  (capítulo não existe em capitulos/)`, group.capitulo);
  }

  const broken = validateStory(files).filter((p) => p.path.startsWith("sessoes/") && p.severity === "erro");
  if (broken.length > 0) {
    const count = new Set(broken.map((p) => p.path)).size;
    lines.push(
      `Atenção: ${count === 1 ? "1 sessão tem" : `${count} sessões têm`} erro no sessao.md e pode não aparecer aqui. Rode "lore-pack check" para ver.`,
    );
  }
  return ok(`${lines.join("\n").trimEnd()}\n`);
}

function closeCommand(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { fechamento: { type: "string" }, resumo: { type: "string" } },
      allowPositionals: true,
    });
  } catch (error) {
    return argsError(error);
  }
  const [id, folder = "."] = parsed.positionals;
  if (!id) return fail(`Informe o id da sessão, por exemplo: lore-pack sessao fechar 2026-10-01-cap-03-01`);

  const story = findStoryRoot(folder);
  if (!story.ok) return fail(story.error);

  const sessionPath = join(story.root, "sessoes", id, "sessao.md");
  if (!isFile(sessionPath)) {
    return fail(`A sessão "${id}" não existe em sessoes/. Rode "lore-pack sessao listar" para ver os ids.`);
  }

  // Confere tudo antes de escrever qualquer coisa.
  const closingSource = parsed.values.fechamento ? resolve(parsed.values.fechamento) : undefined;
  const closingTarget = join(story.root, "sessoes", id, "fechamento.md");
  if (closingSource && !isFile(closingSource)) {
    return fail(`O arquivo de fechamento "${parsed.values.fechamento}" não existe. Confira o caminho do --fechamento.`);
  }
  if (closingSource && isFile(closingTarget)) {
    return fail(`Já existe sessoes/${id}/fechamento.md. Para não apagar esse texto, nada foi alterado.`);
  }

  const closed = closeSession(readText(sessionPath), new Date().toISOString(), parsed.values.resumo);
  if (!closed.ok) return fail(`sessoes/${id}/sessao.md: ${closed.error}`);

  writeFileSync(sessionPath, closed.content);
  const lines = [`Sessão ${id} fechada.`];
  if (closingSource) {
    copyFileSync(closingSource, closingTarget);
    lines.push(`Fechamento copiado para sessoes/${id}/fechamento.md.`);
  }
  lines.push("Aplicar as mudanças do fechamento nas fichas e no estado.md ainda é manual.");
  return ok(`${lines.join("\n")}\n`);
}

function argsError(error: unknown): CliResult {
  const message = error instanceof Error ? error.message : String(error);
  return fail(`${message}\nRode "lore-pack sessao --help" para ver as opções.`);
}
