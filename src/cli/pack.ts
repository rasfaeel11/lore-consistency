import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  buildPack,
  hasPackMarkers,
  isGeneratedByPack,
  PACK_MARK,
  PACK_MARKERS,
  type PackSections,
} from "../core/pack.js";
import { chapterForScene } from "../core/chapters.js";
import { lastScene } from "../core/scene.js";
import { buildSessionFilesBlock } from "../core/session.js";
import { selectFichas, selectReferencias, type SelectedFicha, type SelectedReferencia } from "../core/select.js";
import { estimateTokens } from "../core/tokens.js";
import { readFichas, readReferencias, validateStory, type StoryFile } from "../core/validate.js";
import { formatReport } from "./check.js";
import { TEMPLATES_DIR } from "./paths.js";
import { fail, ok, type CliResult } from "./result.js";
import { isDirectory, isFile, readStoryFiles, readText } from "./story-files.js";

const USAGE = `Uso:
  lore-pack pack --cena <plano.md> [opções] [pasta]

Monta a mensagem de abertura da sessão: bíblia, estado, as fichas citadas no plano
e na última cena, as referências cujas palavras-chave estão no plano, e a última cena.
Grava num arquivo para você colar em qualquer IA.

Opções:
  --cena <arquivo>     plano da próxima cena (obrigatório)
  --com <ids>          inclui fichas mesmo sem citação (separe com vírgula)
  --ref <ids>          inclui referências mesmo sem palavra-chave no plano (separe com vírgula)
  --sem <ids>          tira fichas e referências do pacote (separe com vírgula)
  --alfabeto           inclui o alfabeto.md (para sessões que vão criar nomes)
  --sem-ultima-cena    não inclui a última cena
  --limite <tokens>    avisa se o pacote passar desse número de tokens
  --saida <arquivo>    onde gravar (padrão: pacote.md na pasta da história)
  -h, --help           mostra esta ajuda
`;

const TEMPLATE_PATH = "prompts-de-sessao/00-abrir-sessao.md";

const SECTION_LABELS: Record<keyof PackSections, string> = {
  biblia: "bíblia",
  estado: "estado",
  fichas: "fichas",
  referencias: "referências",
  alfabeto: "alfabeto",
  ultima_cena: "última cena",
};

// Opções que o pack e o "sessao nova" têm em comum.
export const PACK_OPTIONS = {
  com: { type: "string", multiple: true },
  ref: { type: "string", multiple: true },
  sem: { type: "string", multiple: true },
  alfabeto: { type: "boolean" },
  "sem-ultima-cena": { type: "boolean" },
  limite: { type: "string" },
} as const;

type PackOptionValues = {
  com?: string[];
  ref?: string[];
  sem?: string[];
  alfabeto?: boolean;
  "sem-ultima-cena"?: boolean;
  limite?: string;
};

export type PackOptions = {
  include: string[];
  includeRefs: string[];
  exclude: string[];
  alfabeto: boolean;
  omitScene: boolean;
  limit: number | undefined;
};

export type PackRequest = PackOptions & {
  root: string;
  // Texto do plano da cena (a CLI lê do arquivo; o app recebe do formulário).
  plan: string;
  output: string;
  // Capítulo de onde sai a última cena. Sem ele, o mais recente que tenha texto.
  chapter?: string;
  // Pacote de uma sessão: ganha no fim o bloco que diz em quais arquivos a IA pode escrever.
  sessionId?: string;
};

// Converte as opções comuns. Só o --limite pode estar errado.
export function readPackOptions(values: PackOptionValues): { ok: true; options: PackOptions } | { ok: false; error: string } {
  let limit: number | undefined;
  if (values.limite !== undefined) {
    if (!/^\d+$/.test(values.limite) || Number(values.limite) === 0) {
      return { ok: false, error: `--limite precisa ser um número inteiro de tokens, por exemplo: --limite 8000` };
    }
    limit = Number(values.limite);
  }
  return {
    ok: true,
    options: {
      include: splitIds(values.com),
      includeRefs: splitIds(values.ref),
      exclude: splitIds(values.sem),
      alfabeto: Boolean(values.alfabeto),
      omitScene: Boolean(values["sem-ultima-cena"]),
      limit,
    },
  };
}

export function pack(args: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        cena: { type: "string" },
        ...PACK_OPTIONS,
        saida: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack pack --help" para ver as opções.`);
  }
  const options = parsed.values;

  if (options.help) return ok(USAGE);
  if (!options.cena) {
    return fail(`Informe o plano da cena com --cena.\n\n${USAGE}`);
  }

  const common = readPackOptions(options);
  if (!common.ok) return fail(common.error);

  const folder = parsed.positionals[0] ?? ".";
  const root = resolve(folder);
  if (!isDirectory(root)) {
    return fail(
      `A pasta "${folder}" não existe. Confira o caminho ou crie uma história com "lore-pack init <pasta>".`,
    );
  }

  const planPath = resolve(options.cena);
  if (!isFile(planPath)) {
    return fail(`O plano da cena "${options.cena}" não existe. Confira o caminho do --cena.`);
  }

  return writePack({
    ...common.options,
    root,
    plan: readText(planPath),
    output: options.saida ? resolve(options.saida) : join(root, "pacote.md"),
  });
}

// Monta o pacote e grava em request.output. Quem chama já conferiu a pasta.
export function writePack(request: PackRequest): CliResult {
  const { root } = request;

  // Mesma validação do check: com erro nas fichas, não monta pacote.
  const files = readStoryFiles(root);
  const problems = validateStory(files);
  if (problems.some((problem) => problem.severity === "erro")) {
    return fail(`${formatReport(problems, files)}\nCorrija os erros acima antes de montar o pacote.`);
  }
  const warningCount = problems.length;

  // Última cena: a não ser que o usuário peça para omitir.
  const chapter = request.omitScene ? undefined : chapterForScene(files, request.chapter);
  const scene = chapter ? lastScene(findFile(files, chapter)?.content ?? "") : "";

  const fichaFiles = readFichas(files);
  const refFiles = readReferencias(files);
  const selection = selectFichas({
    fichas: fichaFiles.map((f) => f.ficha),
    plan: request.plan,
    lastScene: scene,
    include: request.include,
    exclude: request.exclude,
    referenciaIds: refFiles.map((r) => r.referencia.id),
  });
  // A última cena não entra aqui: referências só vêm do plano ou do --ref.
  const refSelection = selectReferencias({
    referencias: refFiles.map((r) => r.referencia),
    plan: request.plan,
    include: request.includeRefs,
    exclude: request.exclude,
  });
  const selectErrors = [...(selection.ok ? [] : selection.errors), ...(refSelection.ok ? [] : refSelection.errors)];
  if (!selection.ok || !refSelection.ok) return fail(selectErrors.join("\n"));

  // Conteúdo de cada referência escolhida, para o pacote e para os tokens do resumo.
  const refContents = refSelection.selected.map((s) => ({
    ...s,
    content: refFiles.find((r) => r.referencia.id === s.id)?.content.trim() ?? "",
  }));

  let alfabeto = "";
  if (request.alfabeto) {
    const file = findFile(files, "alfabeto.md");
    if (!file) {
      return fail(`--alfabeto: não existe alfabeto.md na pasta da história. Crie o arquivo ou rode sem --alfabeto.`);
    }
    alfabeto = file.content;
  }

  const template = chooseTemplate(root);
  const sections: PackSections = {
    biblia: findFile(files, "biblia.md")?.content ?? "",
    estado: findFile(files, "estado.md")?.content ?? "",
    fichas: selection.selected
      .map((s) => fichaFiles.find((f) => f.ficha.id === s.id)?.content.trim() ?? "")
      .join("\n\n"),
    referencias: refContents.map((r) => r.content).join("\n\n"),
    alfabeto,
    ultima_cena: scene,
  };
  const message = buildPack(template.text, sections);
  const sessionBlock = request.sessionId ? `\n${buildSessionFilesBlock(request.sessionId)}` : "";
  const content = `${PACK_MARK}\n${message}${sessionBlock}`;

  // Princípio 4: só sobrescreve arquivo que o próprio pack gerou.
  const output = request.output;
  if (existsSync(output)) {
    if (!isFile(output)) {
      return fail(`"${output}" é uma pasta. Escolha um arquivo com --saida.`);
    }
    if (!isGeneratedByPack(readText(output))) {
      return fail(
        `O arquivo "${output}" já existe e não foi gerado pelo lore-pack (não começa com a marca "<!-- lore-pack:").\nPara não apagar o seu texto, o pack não vai sobrescrevê-lo. Escolha outro arquivo com --saida, ou renomeie/apague esse arquivo.`,
      );
    }
  }
  writeFileSync(output, content);

  const warnings: string[] = [];
  if (template.usedDefault) {
    warnings.push(
      `O seu ${TEMPLATE_PATH} não existe ou não tem os marcadores {{...}} (pode ter sido criado por uma versão antiga). Usei o modelo padrão. Para personalizar, copie o modelo novo de ${join(TEMPLATES_DIR, TEMPLATE_PATH)}.`,
    );
  }
  if (refContents.length > 0 && !template.text.includes("{{referencias}}")) {
    warnings.push(
      `O seu ${TEMPLATE_PATH} não tem o marcador {{referencias}}, então as referências acima ficaram fora do pacote. Acrescente o bloco "=== REFERÊNCIAS DESTA SESSÃO ===" do modelo novo (${join(TEMPLATES_DIR, TEMPLATE_PATH)}).`,
    );
  }
  if (warningCount > 0) {
    warnings.push(
      `As fichas têm ${warningCount === 1 ? "1 aviso" : `${warningCount} avisos`}. Rode "lore-pack check" para ver.`,
    );
  }

  return ok(
    formatSummary({
      output,
      selected: selection.selected,
      referencias: refContents.map((r) => ({ ...r, tokens: estimateTokens(r.content) })),
      hasReferencias: refFiles.length > 0,
      chapter,
      sceneOmitted: request.omitScene,
      sections,
      template: template.text,
      total: estimateTokens(content),
      limit: request.limit,
      warnings,
    }),
  );
}

// "--com a,b --com c" vira ["a", "b", "c"].
function splitIds(values: string[] | undefined): string[] {
  return (values ?? [])
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

// Usa o 00 do usuário se ele tiver os marcadores; senão, o modelo que vem com o lore-pack.
function chooseTemplate(root: string): { text: string; usedDefault: boolean } {
  const userTemplate = join(root, TEMPLATE_PATH);
  if (isFile(userTemplate)) {
    const text = readText(userTemplate);
    if (hasPackMarkers(text)) return { text, usedDefault: false };
  }
  return { text: readText(join(TEMPLATES_DIR, TEMPLATE_PATH)), usedDefault: true };
}

function findFile(files: StoryFile[], path: string): StoryFile | undefined {
  return files.find((file) => file.path === path);
}

type SummaryInput = {
  output: string;
  selected: SelectedFicha[];
  referencias: (SelectedReferencia & { tokens: number })[];
  hasReferencias: boolean;
  chapter: string | undefined;
  sceneOmitted: boolean;
  sections: PackSections;
  template: string;
  total: number;
  limit: number | undefined;
  warnings: string[];
};

function formatSummary(input: SummaryInput): string {
  const lines = [`Pacote gravado em ${input.output}`, ""];

  if (input.selected.length === 0) {
    lines.push("Fichas no pacote: nenhuma. Cite nomes ou aliases no plano, ou use --com.");
  } else {
    lines.push(`Fichas no pacote (${input.selected.length}):`);
    const idWidth = Math.max(...input.selected.map((s) => s.id.length));
    const reasons = input.selected.map((s) => s.reasons.join(", "));
    const reasonWidth = Math.max(...reasons.map((r) => r.length));
    input.selected.forEach((s, i) => {
      const matched = s.matched.length > 0 ? `casou: ${s.matched.map((m) => `"${m}"`).join(", ")}` : "";
      lines.push(`  ${s.id.padEnd(idWidth)}  ${(reasons[i] ?? "").padEnd(reasonWidth)}  ${matched}`.trimEnd());
    });
  }

  if (input.referencias.length === 0) {
    // Pasta sem nenhuma referência: nem menciona, para não poluir histórias que não usam.
    if (input.hasReferencias) lines.push("Referências no pacote: nenhuma. Cite uma palavra-chave no plano, ou use --ref.");
  } else {
    lines.push(`Referências no pacote (${input.referencias.length}):`);
    const idWidth = Math.max(...input.referencias.map((r) => r.id.length));
    const reasons = input.referencias.map((r) => r.reasons.join(", "));
    const reasonWidth = Math.max(...reasons.map((r) => r.length));
    const matches = input.referencias.map((r) =>
      r.matched.length > 0 ? `casou: ${r.matched.map((m) => `"${m}"`).join(", ")}` : "",
    );
    const matchWidth = Math.max(...matches.map((m) => m.length));
    input.referencias.forEach((r, i) => {
      lines.push(
        `  ${r.id.padEnd(idWidth)}  ${(reasons[i] ?? "").padEnd(reasonWidth)}  ${(matches[i] ?? "").padEnd(matchWidth)}  ~${formatNumber(r.tokens)} tokens`,
      );
    });
  }

  if (input.sceneOmitted) lines.push("Última cena: omitida (--sem-ultima-cena)");
  else if (input.chapter) lines.push(`Última cena: ${input.chapter}`);
  else lines.push("Última cena: nenhum capítulo com texto em capitulos/");

  // Tokens só das seções que entraram no pacote (não vazias e com marcador no modelo).
  const included = PACK_MARKERS.filter(
    (key) => input.sections[key].trim() !== "" && input.template.includes(`{{${key}}}`),
  ).map((key) => ({ label: SECTION_LABELS[key], tokens: estimateTokens(input.sections[key].trim()) }));

  lines.push("", "Tokens (estimativa aproximada: ~1 token a cada 3 caracteres):");
  for (const section of included) {
    lines.push(`  ${section.label.padEnd(12)} ${formatNumber(section.tokens).padStart(8)}`);
  }
  lines.push(`  ${"total".padEnd(12)} ${`~${formatNumber(input.total)}`.padStart(8)}  (inclui as instruções do modelo)`);

  if (input.limit !== undefined && input.total > input.limit) {
    const largest = included.reduce((a, b) => (b.tokens > a.tokens ? b : a), included[0] ?? { label: "-", tokens: 0 });
    lines.push(
      "",
      "!!! ATENÇÃO !!!",
      `O pacote (~${formatNumber(input.total)} tokens) passa do limite de ${formatNumber(input.limit)}.`,
      `A maior seção é "${largest.label}" (~${formatNumber(largest.tokens)} tokens). Considere compactá-la (prompt 07-compactar) ou tirar fichas ou referências com --sem.`,
    );
  }

  if (input.warnings.length > 0) {
    lines.push("", "Avisos:", ...input.warnings.map((w) => `  - ${w}`));
  }
  return `${lines.join("\n")}\n`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}
