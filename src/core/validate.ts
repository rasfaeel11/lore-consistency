import type { z } from "zod";
import { CHAPTER_ID, chapterFileName, listChapters } from "./chapters.js";
import { FICHA_SECTIONS, FOLDER_BY_TIPO, fichaSchema, type Ficha } from "./ficha.js";
import { splitFrontmatter } from "./frontmatter.js";
import { findTerms } from "./mentions.js";
import { normalize } from "./normalize.js";
import { referenciaSchema, type Referencia } from "./referencia.js";
import { sessionFolder, sessionSchema } from "./session.js";

// Um arquivo da pasta da história, já lido. O caminho é relativo à pasta e usa "/".
export type StoryFile = {
  path: string;
  content: string;
};

export type Severity = "erro" | "aviso";

export type Problem = {
  path: string;
  // Campo do cabeçalho com problema, ou null quando o problema é no arquivo todo.
  field: string | null;
  message: string;
  severity: Severity;
};

const REQUIRED_ROOT_FILES = ["biblia.md", "estado.md"];

export function isFichaPath(path: string): boolean {
  return path.startsWith("fichas/") && path.endsWith(".md");
}

export function isReferenciaPath(path: string): boolean {
  return path.startsWith("referencias/") && path.endsWith(".md");
}

// Valida a pasta da história inteira e devolve a lista de problemas (vazia se estiver tudo certo).
export function validateStory(files: StoryFile[]): Problem[] {
  const problems: Problem[] = [];

  for (const required of REQUIRED_ROOT_FILES) {
    if (!files.some((file) => file.path === required)) {
      problems.push({
        path: required,
        field: null,
        message: `Arquivo obrigatório ausente na raiz da pasta. Crie o ${required} (o comando init cria um modelo).`,
        severity: "erro",
      });
    }
  }

  // Fichas que passaram na validação individual seguem para as checagens entre fichas.
  const valid: { path: string; content: string; ficha: Ficha }[] = [];

  for (const file of files.filter((f) => isFichaPath(f.path))) {
    const fichaProblems = validateFicha(file);
    problems.push(...fichaProblems.problems);
    if (fichaProblems.ficha) valid.push({ path: file.path, content: file.content, ficha: fichaProblems.ficha });
  }

  const validRefs: { path: string; content: string; referencia: Referencia }[] = [];
  for (const file of files.filter((f) => isReferenciaPath(f.path))) {
    const refProblems = validateReferencia(file);
    problems.push(...refProblems.problems);
    if (refProblems.referencia) validRefs.push({ path: file.path, content: file.content, referencia: refProblems.referencia });
  }

  // O id é único entre fichas e referências, porque o --sem vale para as duas.
  problems.push(
    ...findDuplicateIds([
      ...valid.map((v) => ({ path: v.path, id: v.ficha.id })),
      ...validRefs.map((v) => ({ path: v.path, id: v.referencia.id })),
    ]),
  );
  problems.push(...findRepeatedNames(valid));
  problems.push(...findWrongFolders(valid));
  problems.push(...findGenericKeywords(validRefs, files));
  problems.push(...findBrokenLinks(valid, files));
  problems.push(...findSectionsOutOfOrder(valid));
  problems.push(...findSecretsInReferences(validRefs));

  problems.push(...validateChapterNames(files));
  const chapterIds = listChapters(files).map((chapter) => chapter.id);
  for (const file of files.filter((f) => sessionFolder(f.path))) {
    problems.push(...validateSession(file, chapterIds));
  }

  return problems;
}

// Uma ficha válida, com o arquivo de onde veio.
export type FichaFile = {
  path: string;
  content: string;
  ficha: Ficha;
};

// Devolve as fichas válidas da pasta. Fichas com erro ficam de fora: rode validateStory antes.
export function readFichas(files: StoryFile[]): FichaFile[] {
  const fichas: FichaFile[] = [];
  for (const file of files.filter((f) => isFichaPath(f.path))) {
    const { ficha } = validateFicha(file);
    if (ficha) fichas.push({ path: file.path, content: file.content, ficha });
  }
  return fichas;
}

// Uma referência válida, com o arquivo de onde veio.
export type ReferenciaFile = {
  path: string;
  content: string;
  referencia: Referencia;
};

// Devolve as referências válidas da pasta. As com erro ficam de fora: rode validateStory antes.
export function readReferencias(files: StoryFile[]): ReferenciaFile[] {
  const referencias: ReferenciaFile[] = [];
  for (const file of files.filter((f) => isReferenciaPath(f.path))) {
    const { referencia } = validateReferencia(file);
    if (referencia) referencias.push({ path: file.path, content: file.content, referencia });
  }
  return referencias;
}

function validateFicha(file: StoryFile): { problems: Problem[]; ficha?: Ficha } {
  const { problems, data } = validateHeader(file, fichaSchema);
  return { problems, ficha: data };
}

function validateReferencia(file: StoryFile): { problems: Problem[]; referencia?: Referencia } {
  const { problems, data } = validateHeader(file, referenciaSchema);
  return { problems, referencia: data };
}

// Valida o cabeçalho com o schema e confere se o id é igual ao nome do arquivo.
// Só devolve os dados se não houver nenhum problema.
function validateHeader<T>(file: StoryFile, schema: z.ZodType<T>): { problems: Problem[]; data?: T } {
  const split = splitFrontmatter(file.content);
  if (!split.ok) {
    return { problems: [error(file.path, null, split.error)] };
  }

  const problems: Problem[] = [];
  const parsed = schema.safeParse(split.data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : null;
      problems.push(error(file.path, field, issue.message));
    }
  }

  // Compara com o nome do arquivo mesmo se outros campos tiverem erro, para mostrar tudo de uma vez.
  const id = split.data.id;
  const fileName = fileNameWithoutExtension(file.path);
  if (typeof id === "string" && id !== fileName) {
    problems.push(
      error(
        file.path,
        "id",
        `O id "${id}" é diferente do nome do arquivo (${fileName}.md). Renomeie o arquivo para ${id}.md ou mude o id para "${fileName}".`,
      ),
    );
  }

  if (!parsed.success || problems.length > 0) return { problems };
  return { problems, data: parsed.data };
}

function validateChapterNames(files: StoryFile[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of files) {
    const name = chapterFileName(file.path);
    if (name === undefined || CHAPTER_ID.test(name)) continue;
    problems.push(
      error(
        file.path,
        null,
        `O nome do capítulo está fora do padrão. Renomeie para cap-NN.md, com o número do capítulo, por exemplo cap-01.md.`,
      ),
    );
  }
  return problems;
}

function validateSession(file: StoryFile, chapterIds: string[]): Problem[] {
  const split = splitFrontmatter(file.content);
  if (!split.ok) return [error(file.path, null, split.error)];

  const problems: Problem[] = [];
  const parsed = sessionSchema.safeParse(split.data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : null;
      problems.push(error(file.path, field, issue.message));
    }
  }

  // Igual às fichas: o id precisa bater com o nome da pasta.
  const id = split.data.id;
  const folder = sessionFolder(file.path);
  if (typeof id === "string" && id !== folder) {
    problems.push(
      error(
        file.path,
        "id",
        `O id "${id}" é diferente do nome da pasta (sessoes/${folder}/). Renomeie a pasta para ${id} ou mude o id para "${folder}".`,
      ),
    );
  }

  const capitulo = split.data.capitulo;
  if (typeof capitulo === "string" && CHAPTER_ID.test(capitulo) && !chapterIds.includes(capitulo)) {
    problems.push(
      error(
        file.path,
        "capitulo",
        `O capítulo "${capitulo}" não existe: não há capitulos/${capitulo}.md. Crie o capítulo com "lore-pack capitulo novo" ou corrija o campo.`,
      ),
    );
  }
  return problems;
}

function findDuplicateIds(valid: { path: string; id: string }[]): Problem[] {
  const problems: Problem[] = [];
  for (const { path, id } of valid) {
    const others = valid.filter((v) => v.id === id && v.path !== path);
    if (others.length > 0) {
      problems.push(
        error(
          path,
          "id",
          `O id "${id}" também é usado em ${others.map((o) => o.path).join(", ")}. Cada ficha e referência precisa de um id único: mude um deles e renomeie o arquivo junto.`,
        ),
      );
    }
  }
  return problems;
}

// Palavra-chave que aparece em mais da metade das outras fichas e referências puxaria
// a referência em quase toda sessão.
function findGenericKeywords(validRefs: { path: string; referencia: Referencia }[], files: StoryFile[]): Problem[] {
  const candidates = files.filter((f) => isFichaPath(f.path) || isReferenciaPath(f.path));
  const problems: Problem[] = [];
  for (const { path, referencia } of validRefs) {
    const others = candidates.filter((f) => f.path !== path);
    if (others.length === 0) continue;
    for (const keyword of referencia.palavras_chave) {
      const count = others.filter((f) => findTerms(f.content, [{ id: referencia.id, terms: [keyword] }]).length > 0).length;
      if (count * 2 <= others.length) continue;
      problems.push({
        path,
        field: "palavras_chave",
        message: `A palavra-chave "${keyword}" aparece em ${count} de ${others.length} outras fichas e referências. Com ela, esta referência entraria em quase toda sessão. Troque por um termo mais específico.`,
        severity: "aviso",
      });
    }
  }
  return problems;
}

// Todo id citado precisa existir: os de "relacionados" e os [[id]] do corpo.
// Vale ficha ou referência. Usa o nome do arquivo (que é o id), para uma ficha com erro
// no cabeçalho não fazer todos os links para ela parecerem quebrados.
function findBrokenLinks(valid: { path: string; content: string; ficha: Ficha }[], files: StoryFile[]): Problem[] {
  const known = new Set(
    files.filter((f) => isFichaPath(f.path) || isReferenciaPath(f.path)).map((f) => fileNameWithoutExtension(f.path)),
  );
  const fix = "Corrija o id, crie a ficha que falta ou tire a citação.";
  const problems: Problem[] = [];
  for (const { path, content, ficha } of valid) {
    for (const id of new Set(ficha.relacionados)) {
      if (known.has(id)) continue;
      problems.push({
        path,
        field: "relacionados",
        message: `"${id}" está em relacionados, mas não existe ficha nem referência com esse id. ${fix}`,
        severity: "aviso",
      });
    }
    const split = splitFrontmatter(content);
    const body = split.ok ? split.body : "";
    const linked = new Set([...body.matchAll(/\[\[([^\[\]]+)\]\]/g)].map((match) => (match[1] ?? "").trim()));
    for (const id of linked) {
      if (known.has(id)) continue;
      problems.push({
        path,
        field: null,
        message: `O link [[${id}]] aponta para um id que não existe em fichas/ nem em referencias/. ${fix}`,
        severity: "aviso",
      });
    }
  }
  return problems;
}

// Títulos "## ..." do corpo, já normalizados (sem acento, minúsculas).
function hashHeadings(content: string): string[] {
  const split = splitFrontmatter(content);
  const body = split.ok ? split.body : content;
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => normalizeName(match[1] ?? ""));
}

// Só olha as seções do modelo que a ficha tem: ficha no formato antigo (títulos em negrito) passa.
function findSectionsOutOfOrder(valid: { path: string; content: string }[]): Problem[] {
  const order = FICHA_SECTIONS.map(normalizeName);
  const problems: Problem[] = [];
  for (const { path, content } of valid) {
    const found = hashHeadings(content)
      .map((title) => order.indexOf(title))
      .filter((index) => index >= 0);
    if (found.every((index, i) => i === 0 || index > (found[i - 1] ?? -1))) continue;
    problems.push({
      path,
      field: null,
      message: `As seções estão fora de ordem ou repetidas. A ordem é: ${FICHA_SECTIONS.map((title) => `## ${title}`).join(", ")}. Mova as seções sem mudar o texto delas.`,
      severity: "aviso",
    });
  }
  return problems;
}

// Referência entra no pacote por palavra-chave, sem ninguém escolher: segredo ali vaza fácil.
function findSecretsInReferences(validRefs: { path: string; content: string }[]): Problem[] {
  const problems: Problem[] = [];
  for (const { path, content } of validRefs) {
    if (!hashHeadings(content).some((title) => title.startsWith("segredo"))) continue;
    problems.push({
      path,
      field: null,
      message: `Referência não tem seção de segredos. Mova o segredo para a bíblia ou para a seção "## Segredo do autor" de uma ficha, e deixe aqui só "ver a bíblia".`,
      severity: "aviso",
    });
  }
  return problems;
}

function findRepeatedNames(valid: { path: string; ficha: Ficha }[]): Problem[] {
  // Agrupa cada nome/alias (normalizado) com as fichas onde ele aparece.
  const byName = new Map<string, { path: string; original: string; field: string }[]>();

  for (const { path, ficha } of valid) {
    const seenInThisFicha = new Set<string>();
    const names = [
      { original: ficha.nome, field: "nome" },
      ...ficha.aliases.map((alias) => ({ original: alias, field: "aliases" })),
    ];
    for (const { original, field } of names) {
      const key = normalizeName(original);
      if (key === "" || seenInThisFicha.has(key)) continue;
      seenInThisFicha.add(key);
      const group = byName.get(key) ?? [];
      group.push({ path, original, field });
      byName.set(key, group);
    }
  }

  const problems: Problem[] = [];
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    for (const entry of group) {
      const others = group
        .filter((other) => other.path !== entry.path)
        .map((other) => `${other.path} (como "${other.original}")`)
        .join(", ");
      problems.push({
        path: entry.path,
        field: entry.field,
        message: `"${entry.original}" também aparece em ${others}. O pack não vai saber de qual ficha é esse nome. Deixe cada nome ou alias em uma ficha só.`,
        severity: "aviso",
      });
    }
  }
  return problems;
}

function findWrongFolders(valid: { path: string; ficha: Ficha }[]): Problem[] {
  const problems: Problem[] = [];
  for (const { path, ficha } of valid) {
    const segments = path.split("/");
    // fichas/<pasta>/<arquivo>.md: a pasta é o segundo pedaço, se existir.
    const folder = segments.length >= 3 ? segments[1] : undefined;
    const expected = FOLDER_BY_TIPO[ficha.tipo];
    if (folder !== expected) {
      const where = folder ? `fichas/${folder}/` : "fichas/";
      problems.push({
        path,
        field: "tipo",
        message: `A ficha é do tipo "${ficha.tipo}", mas está em ${where}. Mova o arquivo para fichas/${expected}/ ou corrija o tipo.`,
        severity: "aviso",
      });
    }
  }
  return problems;
}

// Compara nomes sem diferenciar maiúsculas, acentos e espaços extras.
function normalizeName(name: string): string {
  return normalize(name).replace(/\s+/g, " ").trim();
}

function fileNameWithoutExtension(path: string): string {
  const fileName = path.split("/").at(-1) ?? "";
  return fileName.slice(0, -".md".length);
}

function error(path: string, field: string | null, message: string): Problem {
  return { path, field, message, severity: "erro" };
}
