// Mudanças do fechamento da sessão: a IA termina a resposta do prompt 04 com um bloco
// "lore-pack-mudancas" (JSON), e o autor escolhe quais operações aplicar antes de qualquer gravação.
// Tudo aqui é puro: recebe textos, devolve textos. Quem lê e grava é o apply (CLI) e o app.
import { z } from "zod";
import { FOLDER_BY_TIPO, TIPOS, fichaSchema, idField } from "./ficha.js";
import { splitFrontmatter } from "./frontmatter.js";
import { diffLines } from "./guard.js";
import { normalize } from "./normalize.js";
import { isFichaPath, isReferenciaPath, validateStory, type Problem, type StoryFile } from "./validate.js";

export const BLOCK_LABEL = "lore-pack-mudancas";
// Seção do alfabeto.md (modelo do init) que recebe os nomes novos quando a operação não diz outra.
const USED_NAMES_SECTION = "Nomes já usados";

function missing(field: string): string {
  return `Falta o campo "${field}".`;
}

function text(field: string) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? missing(field) : `"${field}" precisa ser um texto.`) })
    .min(1, { error: `"${field}" está vazio.` });
}

function lineList(field: string) {
  return z
    .array(
      z
        .string({ error: `Cada item de "${field}" precisa ser um texto.` })
        .refine((line) => line.trim() !== "" && !/[\r\n]/.test(line), {
          error: `Cada item de "${field}" é uma linha só, não vazia. Ponha cada linha num item da lista.`,
        }),
      {
        error: (issue) =>
          issue.input === undefined
            ? missing(field)
            : `"${field}" precisa ser uma lista de textos, por exemplo: "${field}": ["primeira linha", "segunda linha"]`,
      },
    )
    .min(1, { error: `"${field}" está vazia. Ponha pelo menos uma linha ou tire a operação.` });
}

const newText = z.string({
  error: (issue) => (issue.input === undefined ? missing("novo") : '"novo" precisa ser um texto.'),
});

// Uma operação por tipo, escolhida pelo campo "op". Objetos estritos: campo que não existe
// (por exemplo "arquivo") vira erro em vez de ser ignorado. Nenhuma operação apaga arquivo
// nem recebe caminho: o caminho é sempre calculado (targetPath). O id usa a regra do check
// (idField), e é ela que impede um id como "../../biblia" de virar caminho.
export const operationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("estado_adicionar"), secao: text("secao"), linhas: lineList("linhas") }),
  z.strictObject({ op: z.literal("estado_substituir"), antigo: text("antigo"), novo: newText }),
  z.strictObject({
    op: z.literal("ficha_criar"),
    tipo: z.enum(TIPOS, {
      error: (issue) =>
        issue.input === undefined
          ? missing("tipo")
          : `O tipo "${String(issue.input)}" não existe. Use um de: ${TIPOS.join(", ")}.`,
    }),
    id: idField,
    conteudo: text("conteudo"),
  }),
  z.strictObject({ op: z.literal("ficha_adicionar"), id: idField, secao: text("secao"), linhas: lineList("linhas") }),
  z.strictObject({ op: z.literal("ficha_substituir"), id: idField, antigo: text("antigo"), novo: newText }),
  z.strictObject({ op: z.literal("alfabeto_adicionar"), linhas: lineList("linhas"), secao: text("secao").optional() }),
  // Só informativo: nunca é aplicado.
  z.strictObject({
    op: z.literal("nao_aprovado"),
    itens: z.array(z.string({ error: 'Cada item de "itens" precisa ser um texto.' }), {
      error: (issue) => (issue.input === undefined ? missing("itens") : '"itens" precisa ser uma lista de textos.'),
    }),
  }),
]);

export type Operation = z.infer<typeof operationSchema>;
// As operações que mudam arquivo (todas menos nao_aprovado).
type Change = Exclude<Operation, { op: "nao_aprovado" }>;

const OPERATION_NAMES: string[] = operationSchema.options.map((option) => option.shape.op.value);

export type ExtractResult = { ok: true; operations: Operation[] } | { ok: false; error: string };

// Acha o bloco na resposta da IA, lê o JSON e valida cada operação.
// Nunca lança exceção: bloco ausente, JSON inválido e operação errada viram { ok: false, error }.
export function extractChanges(response: string): ExtractResult {
  const content = response.replace(/\r\n/g, "\n");
  // Da linha "```lore-pack-mudancas" até a próxima linha que começa com três crases.
  const pattern = new RegExp(`^[ \\t]*\`\`\`+[ \\t]*${BLOCK_LABEL}[ \\t]*\\n([\\s\\S]*?)^[ \\t]*\`\`\`+[ \\t]*$`, "gm");
  // Vale o último bloco: a IA pode citar um exemplo antes do bloco de verdade.
  const block = [...content.matchAll(pattern)].at(-1);

  if (!block) {
    if (content.includes(BLOCK_LABEL)) {
      return {
        ok: false,
        error: `Achei a etiqueta ${BLOCK_LABEL}, mas não um bloco completo: faltam as três crases de abertura ou as três crases de fechamento (a resposta pode ter sido cortada).`,
      };
    }
    return {
      ok: false,
      error:
        `Não achei o bloco de mudanças. A resposta precisa terminar com um bloco de código com a etiqueta ${BLOCK_LABEL}.\n` +
        `Se esta pasta foi criada antes de o apply existir, o prompts-de-sessao/04-fechar-sessao.md dela é o antigo, que não pede o bloco. ` +
        `Para pegar o novo: rode "lore-pack init <pasta-nova-vazia>" e copie de lá o prompts-de-sessao/04-fechar-sessao.md para esta pasta.`,
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(block[1] ?? "");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `O bloco ${BLOCK_LABEL} não é um JSON válido (${detail}). Confira vírgulas, aspas duplas e chaves.`,
    };
  }
  const list = typeof data === "object" && data !== null ? (data as { operacoes?: unknown }).operacoes : undefined;
  if (!Array.isArray(list)) {
    return { ok: false, error: `O bloco ${BLOCK_LABEL} precisa ser um objeto com a lista "operacoes": { "operacoes": [ { "op": ... }, ... ] }` };
  }

  const operations: Operation[] = [];
  const errors: string[] = [];
  list.forEach((item: unknown, index) => {
    const parsed = parseOperation(item);
    if (parsed.ok) operations.push(parsed.operation);
    else errors.push(`Operação ${index + 1}${parsed.name ? ` (${parsed.name})` : ""}: ${parsed.error}`);
  });
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };
  return { ok: true, operations };
}

function parseOperation(item: unknown): { ok: true; operation: Operation } | { ok: false; error: string; name?: string } {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return { ok: false, error: 'precisa ser um objeto com o campo "op", por exemplo: { "op": "alfabeto_adicionar", "linhas": ["..."] }' };
  }
  // O "op" é conferido antes do schema para a mensagem dizer quais operações existem.
  const name = (item as { op?: unknown }).op;
  if (typeof name !== "string" || !OPERATION_NAMES.includes(name)) {
    return {
      ok: false,
      error: `operação desconhecida ${JSON.stringify(name) ?? '(sem o campo "op")'}. As operações permitidas são: ${OPERATION_NAMES.join(", ")}.`,
    };
  }

  const parsed = operationSchema.safeParse(item);
  if (parsed.success) return { ok: true, operation: parsed.data };

  const messages = parsed.error.issues.map((issue) =>
    issue.code === "unrecognized_keys"
      ? `Campo desconhecido: ${issue.keys.map((key) => `"${key}"`).join(", ")}.`
      : issue.message,
  );
  return { ok: false, name, error: messages.join(" ") };
}

// Texto pronto para colar de volta na IA quando o bloco vem inválido.
export function buildFixPrompt(error: string): string {
  return `O bloco ${BLOCK_LABEL} do seu fechamento não pôde ser lido:

${error}

Reenvie só o bloco, corrigido, sem mudar o conteúdo das propostas e sem repetir o resto do fechamento.
Lembre: um bloco de código só, com a etiqueta ${BLOCK_LABEL}, contendo JSON válido (aspas duplas, sem vírgula sobrando, sem comentários) no formato { "operacoes": [ ... ] }. Operações permitidas:
- { "op": "estado_adicionar", "secao": "...", "linhas": ["..."] }
- { "op": "estado_substituir", "antigo": "...", "novo": "..." }
- { "op": "ficha_criar", "tipo": "...", "id": "...", "conteudo": "..." }
- { "op": "ficha_adicionar", "id": "...", "secao": "...", "linhas": ["..."] }
- { "op": "ficha_substituir", "id": "...", "antigo": "...", "novo": "..." }
- { "op": "alfabeto_adicionar", "linhas": ["..."] }
- { "op": "nao_aprovado", "itens": ["..."] }
`;
}

type OperationResult = { ok: true; content: string } | { ok: false; error: string };

// Aplica uma operação ao conteúdo atual do arquivo dela (undefined = o arquivo não existe)
// e devolve o conteúdo novo. Qual é o arquivo quem decide é o targetPath.
function applyOperation(current: string | undefined, operation: Change): OperationResult {
  if (operation.op === "ficha_criar") return createFicha(current, operation);
  if (current === undefined) {
    const file = operation.op.startsWith("estado") ? "estado.md" : "alfabeto.md";
    return { ok: false, error: `${file} não existe na pasta da história. Crie o arquivo (o comando init cria um modelo).` };
  }

  switch (operation.op) {
    case "estado_adicionar":
      return appendToSection(current, operation.secao, operation.linhas, false);
    case "estado_substituir":
      return replaceOnce(current, operation.antigo, operation.novo, "no estado.md");
    case "ficha_adicionar":
      return appendToSection(current, operation.secao, operation.linhas, true);
    case "ficha_substituir":
      return replaceOnce(current, operation.antigo, operation.novo, "na ficha");
    case "alfabeto_adicionar":
      return appendToSection(current, operation.secao ?? USED_NAMES_SECTION, operation.linhas, false);
  }
}

function createFicha(current: string | undefined, operation: Extract<Change, { op: "ficha_criar" }>): OperationResult {
  if (current !== undefined) {
    return {
      ok: false,
      error: `A ficha "${operation.id}" já existe. Para mudar uma ficha existente, use ficha_adicionar ou ficha_substituir.`,
    };
  }
  const content = operation.conteudo.replace(/\r\n/g, "\n");
  const split = splitFrontmatter(content);
  if (!split.ok) return { ok: false, error: `O conteúdo da ficha nova não tem um cabeçalho válido. ${split.error}` };
  const parsed = fichaSchema.safeParse(split.data);
  if (!parsed.success) {
    return { ok: false, error: `O cabeçalho da ficha nova é inválido. ${parsed.error.issues.map((issue) => issue.message).join(" ")}` };
  }
  if (parsed.data.id !== operation.id) {
    return { ok: false, error: `O conteúdo tem id "${parsed.data.id}", mas a operação pede id "${operation.id}". Os dois precisam ser iguais.` };
  }
  if (parsed.data.tipo !== operation.tipo) {
    return { ok: false, error: `O conteúdo tem tipo "${parsed.data.tipo}", mas a operação pede tipo "${operation.tipo}". Os dois precisam ser iguais.` };
  }
  return { ok: true, content: content.endsWith("\n") ? content : `${content}\n` };
}

function replaceOnce(current: string, oldText: string, replacement: string, where: string): OperationResult {
  const before = oldText.replace(/\r\n/g, "\n");
  const count = current.split(before).length - 1;
  if (count === 0) {
    return { ok: false, error: `O trecho "${before}" não aparece ${where}. Ele precisa ser copiado exatamente como está no arquivo.` };
  }
  if (count > 1) {
    return {
      ok: false,
      error: `O trecho "${before}" aparece ${count} vezes ${where}; precisa aparecer exatamente uma. Use um trecho maior, que só exista num lugar.`,
    };
  }
  const start = current.indexOf(before);
  // Sem String.replace: nele, "$&" e "$1" no texto novo teriam significado especial.
  return { ok: true, content: current.slice(0, start) + replacement.replace(/\r\n/g, "\n") + current.slice(start + before.length) };
}

type Heading = { line: number; level: number; title: string; key: string };
type Section = { ok: true; heading: Heading; end: number } | { ok: false; error: string };

// Títulos do arquivo. As linhas "#" a "######" valem em qualquer arquivo; nas fichas (bold = true)
// também vale a linha que começa com negrito, como "**Fatos** (telegráfico...):" no modelo.
function findHeadings(lines: string[], bold: boolean): Heading[] {
  const headings: Heading[] = [];
  // Só o corpo: um comentário "# ..." dentro do cabeçalho YAML não é título.
  let first = 0;
  if (lines[0]?.trim() === "---") {
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closing > 0) first = closing + 1;
  }

  for (let line = first; line < lines.length; line++) {
    const hash = /^(#{1,6})\s+(.+)$/.exec(lines[line] ?? "");
    const strong = bold ? /^\*\*(.+?)\*\*/.exec(lines[line] ?? "") : null;
    if (hash) headings.push({ line, level: hash[1]?.length ?? 1, title: hash[2] ?? "", key: sectionKey(hash[2] ?? "") });
    // Negrito fica abaixo de qualquer "#": uma seção "## Passado" pode ter "**Fatos**" dentro.
    else if (strong) headings.push({ line, level: 7, title: strong[1] ?? "", key: sectionKey(strong[1] ?? "") });
  }
  return headings;
}

// "## Capítulos (3 a 5 linhas cada)", "**Relações:**" e "relacoes" precisam se encontrar:
// tira "#", "*", o texto final entre parênteses, os dois-pontos, acentos e maiúsculas.
function sectionKey(title: string): string {
  const clean = title
    .replace(/^#+\s*/, "")
    .replaceAll("*", "")
    .replace(/\([^)]*\)\s*:?\s*$/, "")
    .replace(/:\s*$/, "");
  return normalize(clean).replace(/\s+/g, " ").trim();
}

function findSection(lines: string[], name: string, bold: boolean): Section {
  const headings = findHeadings(lines, bold);
  const matches = headings.filter((heading) => heading.key === sectionKey(name));
  const [heading] = matches;
  const titles = headings.map((h) => `"${h.title}"`).join(", ");
  if (heading === undefined) {
    return {
      ok: false,
      error: `A seção "${name}" não existe no arquivo. ${titles ? `Seções que existem: ${titles}.` : "O arquivo não tem nenhuma seção."} Use uma delas ou crie a seção no arquivo antes.`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `A seção "${name}" aparece ${matches.length} vezes no arquivo (seções que existem: ${titles}). Deixe uma só para o lore-pack saber onde escrever.`,
    };
  }
  // A seção vai até o próximo título do mesmo nível ou acima.
  const next = headings.find((h) => h.line > heading.line && h.level <= heading.level);
  return { ok: true, heading, end: next ? next.line : lines.length };
}

// Acrescenta as linhas depois da última linha com texto da seção. Comentários ficam onde estão.
function appendToSection(content: string, name: string, added: string[], bold: boolean): OperationResult {
  const lines = content.split("\n");
  const section = findSection(lines, name, bold);
  if (!section.ok) return section;

  const start = section.heading.line;
  // Linhas que já estão na seção não entram de novo.
  const existing = new Set(lines.slice(start + 1, section.end).map((line) => line.trim()));
  const fresh = added.filter((line) => !existing.has(line.trim()));
  if (fresh.length === 0) {
    return { ok: false, error: `As linhas já estão na seção "${name}". Esta operação já foi aplicada?` };
  }

  let last = section.end - 1;
  while (last > start && (lines[last] ?? "").trim() === "") last--;
  // O modelo da ficha deixa um marcador vazio ("- ") em cada seção: a primeira linha entra no lugar dele.
  const placeholder = last > start && (lines[last] ?? "").trim() === "-";
  lines.splice(placeholder ? last : last + 1, placeholder ? 1 : 0, ...fresh);

  const result = lines.join("\n");
  return { ok: true, content: result.endsWith("\n") ? result : `${result}\n` };
}

// O apply só toca estado.md, alfabeto.md e fichas. Os caminhos nunca vêm da IA (são montados
// a partir do tipo e do id, já validados); esta é a segunda conferência, usada também por quem grava.
export function isAllowedTarget(path: string): boolean {
  if (path === "estado.md" || path === "alfabeto.md") return true;
  return isFichaPath(path) && !path.split("/").some((part) => part === ".." || part === "." || part === "") && !path.includes("\\");
}

type TargetResult = { ok: true; path: string } | { ok: false; error: string };

// O arquivo que a operação muda. As fichas são achadas pelo id (o nome do arquivo), em qualquer pasta de fichas/.
function targetPath(operation: Change, files: StoryFile[]): TargetResult {
  if (operation.op === "estado_adicionar" || operation.op === "estado_substituir") return { ok: true, path: "estado.md" };
  if (operation.op === "alfabeto_adicionar") return { ok: true, path: "alfabeto.md" };

  const fileName = `/${operation.id}.md`;
  const fichas = files.filter((file) => isFichaPath(file.path) && file.path.endsWith(fileName));
  if (fichas.length > 1) {
    return {
      ok: false,
      error: `O id "${operation.id}" é usado em mais de uma ficha (${fichas.map((f) => f.path).join(", ")}). Rode "lore-pack check" e corrija antes.`,
    };
  }
  const existing = fichas[0]?.path;
  const referencia = files.find((file) => isReferenciaPath(file.path) && file.path.endsWith(fileName));

  if (operation.op === "ficha_criar") {
    // Com a ficha já existente, devolve o caminho dela: o applyOperation recusa com "já existe".
    if (existing) return { ok: true, path: existing };
    if (referencia) {
      return {
        ok: false,
        error: `O id "${operation.id}" já é usado pela referência ${referencia.path}. Fichas e referências não podem repetir id: escolha outro.`,
      };
    }
    return { ok: true, path: `fichas/${FOLDER_BY_TIPO[operation.tipo]}/${operation.id}.md` };
  }

  if (existing) return { ok: true, path: existing };
  if (referencia) {
    return { ok: false, error: `"${operation.id}" é uma referência (${referencia.path}), e o apply não altera referências. Edite o arquivo à mão.` };
  }
  return { ok: false, error: `A ficha "${operation.id}" não existe em fichas/. Confira o id ou, se ela é nova, use ficha_criar.` };
}

type Step = { ok: true; path: string; content: string; diff: string; created: boolean } | { ok: false; error: string };

// O que uma operação faria nos arquivos recebidos: arquivo, conteúdo novo e diff. Não muda nada.
function runOperation(operation: Change, files: StoryFile[]): Step {
  const target = targetPath(operation, files);
  if (!target.ok) return target;
  if (!isAllowedTarget(target.path)) {
    return { ok: false, error: `O arquivo ${target.path} não pode ser alterado pelo apply. Só estado.md, alfabeto.md e fichas.` };
  }

  const current = files.find((file) => file.path === target.path)?.content;
  const result = applyOperation(current, operation);
  if (!result.ok) return result;
  return {
    ok: true,
    path: target.path,
    content: result.content,
    diff: diffLines(current ?? "", result.content),
    created: current === undefined,
  };
}

// Cópia da lista com o arquivo trocado (ou acrescentado). A lista recebida não muda.
function withFile(files: StoryFile[], path: string, content: string): StoryFile[] {
  return [...files.filter((file) => file.path !== path), { path, content }];
}

export type PreviewItem = {
  // Posição na lista, a partir de 1: é o número que o autor usa para escolher.
  index: number;
  op: Operation["op"];
  title: string;
  // null quando não há arquivo: operação informativa ou com erro antes de achar o arquivo.
  path: string | null;
  kind: "criado" | "alterado" | "informativo";
  diff: string;
  // Presente quando a operação não pode ser aplicada.
  error?: string;
};

// O que cada operação faria, em ordem, cada uma enxergando o resultado das anteriores que deram certo
// (assim ficha_criar seguida de ficha_adicionar na mesma ficha funciona). Tudo em memória: nada é gravado.
export function previewChanges(operations: Operation[], files: StoryFile[]): PreviewItem[] {
  let current = files;
  return operations.map((operation, position) => {
    const base = { index: position + 1, op: operation.op, title: describeOperation(operation) };
    if (operation.op === "nao_aprovado") {
      return { ...base, path: null, kind: "informativo", diff: operation.itens.map((item) => `- ${item}`).join("\n") };
    }
    const kind = operation.op === "ficha_criar" ? "criado" : "alterado";
    const step = runOperation(operation, current);
    if (!step.ok) return { ...base, path: null, kind, diff: "", error: step.error };
    current = withFile(current, step.path, step.content);
    return { ...base, path: step.path, kind: step.created ? "criado" : "alterado", diff: step.diff };
  });
}

export type ApplyResult = { ok: true; changed: StoryFile[] } | { ok: false; error: string };

// Aplica as operações escolhidas, em memória, e devolve os arquivos que mudaram (em ordem de caminho).
// Tudo ou nada: se uma operação falhar, ou se o resultado tiver um erro de validação que não
// existia antes, nada é devolvido.
export function applyChanges(operations: Operation[], files: StoryFile[]): ApplyResult {
  let current = files;
  const paths = new Set<string>();
  const errors: string[] = [];
  for (const operation of operations) {
    if (operation.op === "nao_aprovado") continue;
    const step = runOperation(operation, current);
    if (!step.ok) {
      errors.push(`${describeOperation(operation)}: ${step.error}`);
      continue;
    }
    current = withFile(current, step.path, step.content);
    paths.add(step.path);
  }
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };

  const key = (problem: Problem) => `${problem.path}|${problem.field}|${problem.message}`;
  const onlyErrors = (list: StoryFile[]) => validateStory(list).filter((problem) => problem.severity === "erro");
  const before = new Set(onlyErrors(files).map(key));
  const created = onlyErrors(current).filter((problem) => !before.has(key(problem)));
  if (created.length > 0) {
    const list = created.map((problem) => `${problem.path}: ${problem.field ? `[${problem.field}] ` : ""}${problem.message}`);
    return { ok: false, error: `Com essas mudanças, o check passaria a acusar:\n${list.join("\n")}` };
  }

  const changed = current.filter((file) => paths.has(file.path)).sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, changed };
}

// Uma linha que diz o que a operação faz, para a lista do apply e do app.
export function describeOperation(operation: Operation): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (operation.op) {
    case "estado_adicionar":
      return `estado.md: acrescentar ${count(operation.linhas.length, "linha", "linhas")} em "${operation.secao}"`;
    case "estado_substituir":
      return "estado.md: trocar um trecho";
    case "ficha_criar":
      return `criar a ficha ${operation.id} (${operation.tipo})`;
    case "ficha_adicionar":
      return `ficha ${operation.id}: acrescentar ${count(operation.linhas.length, "linha", "linhas")} em "${operation.secao}"`;
    case "ficha_substituir":
      return `ficha ${operation.id}: trocar um trecho`;
    case "alfabeto_adicionar":
      return `alfabeto.md: acrescentar ${count(operation.linhas.length, "linha", "linhas")}${operation.secao ? ` em "${operation.secao}"` : ""}`;
    case "nao_aprovado":
      return `não aprovado (${count(operation.itens.length, "item", "itens")}, só para você saber)`;
  }
}
