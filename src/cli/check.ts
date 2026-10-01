import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { isFichaPath, validateStory, type Problem, type StoryFile } from "../core/validate.js";
import { fail, type CliResult } from "./result.js";

// Lê a pasta da história, valida e monta o relatório. Sai com 1 se houver algum erro.
export function check(folder: string = "."): CliResult {
  const root = resolve(folder);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return fail(
      `A pasta "${folder}" não existe. Confira o caminho ou crie uma história com "lore-pack init <pasta>".`,
    );
  }

  const files = readStoryFiles(root);
  const problems = validateStory(files);
  const fichaCount = files.filter((file) => isFichaPath(file.path)).length;
  const hasErrors = problems.some((problem) => problem.severity === "erro");

  return {
    exitCode: hasErrors ? 1 : 0,
    stdout: formatReport(problems, fichaCount),
    stderr: "",
  };
}

// Lê só o que a validação usa: os .md da raiz e os .md dentro de fichas/.
function readStoryFiles(root: string): StoryFile[] {
  const files: StoryFile[] = [];
  for (const relative of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    // O núcleo espera caminhos com "/", mesmo no Windows.
    const path = relative.split(sep).join("/");
    const isRootFile = !path.includes("/");
    if (!path.endsWith(".md") || !(isRootFile || path.startsWith("fichas/"))) continue;

    const fullPath = join(root, relative);
    if (!statSync(fullPath).isFile()) continue;
    files.push({ path, content: readFileSync(fullPath, "utf8") });
  }
  return files;
}

function formatReport(problems: Problem[], fichaCount: number): string {
  const validated = plural(fichaCount, "ficha validada", "fichas validadas");
  if (problems.length === 0) {
    return `Tudo certo: ${validated}.\n`;
  }

  const lines: string[] = [];
  const paths = [...new Set(problems.map((problem) => problem.path))].sort();
  for (const path of paths) {
    lines.push(path);
    for (const problem of problems.filter((p) => p.path === path)) {
      const field = problem.field ? `[${problem.field}] ` : "";
      lines.push(`  ${problem.severity.padEnd(5)} ${field}${problem.message}`);
    }
    lines.push("");
  }

  const errors = problems.filter((problem) => problem.severity === "erro").length;
  const warnings = problems.length - errors;
  lines.push(
    `${plural(errors, "erro", "erros")}, ${plural(warnings, "aviso", "avisos")}. ${validated}.`,
  );
  return `${lines.join("\n")}\n`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
