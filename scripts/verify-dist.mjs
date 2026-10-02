// Confere o build (dist/) como o usuário vai rodar: rode depois do "npm run build".
// 1. Todo comando da lista aparece no --help e responde ao próprio --help (está registrado).
// 2. Os arquivos que o servidor e o init usam existem onde o código do dist procura.
// 3. O pacote do npm (campo "files") leva tudo isso junto.
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const dist = (path) => new URL(`../dist/${path}`, import.meta.url);
const problems = [];

if (!existsSync(dist("index.js"))) {
  console.error('dist/index.js não existe. Rode "npm run build" antes.');
  process.exit(1);
}

const run = (args) => spawnSync(process.execPath, [fileURLToPath(dist("index.js")), ...args], { encoding: "utf8" });

const { COMMANDS } = await import(dist("cli/commands.js"));
const help = run(["--help"]).stdout;
for (const command of COMMANDS) {
  if (!help.includes(`  ${command.usage}`)) problems.push(`"${command.name}" não aparece no --help do dist.`);
  const own = run([command.name, "--help"]);
  if (own.status !== 0) problems.push(`"${command.name} --help" saiu com ${own.status}: ${own.stderr.trim()}`);
}

const { WEB_DIR, TEMPLATES_DIR, INSTRUCTIONS_DIR } = await import(dist("cli/paths.js"));
const { WEB_FILES } = await import(dist("server/app.js"));
for (const file of WEB_FILES) {
  if (!existsSync(join(WEB_DIR, file))) problems.push(`Falta ${join(WEB_DIR, file)}, que o servidor serve.`);
}
if (!existsSync(join(TEMPLATES_DIR, "biblia.md"))) problems.push(`Falta ${TEMPLATES_DIR}, que o init copia.`);
if (!existsSync(join(INSTRUCTIONS_DIR, "instrucoes-ia.md"))) problems.push(`Falta ${INSTRUCTIONS_DIR}, que o init grava.`);

// --dry-run não cria o .tgz; --json lista os arquivos que iriam no pacote.
// Comando fixo, sem nada vindo de fora: pode passar pelo shell (no Windows o npm é um .cmd).
const packed = JSON.parse(execSync("npm pack --dry-run --json --ignore-scripts", { cwd: root, encoding: "utf8" }));
const shipped = new Set(packed[0].files.map((file) => file.path));
const needed = ["dist/index.js", "templates/biblia.md", "instrucoes/instrucoes-ia.md", "instrucoes/claude-settings.json", ...WEB_FILES.map((file) => `web/${file}`)];
for (const path of needed) {
  if (!shipped.has(path)) problems.push(`${path} não vai no pacote do npm (confira o campo "files" do package.json).`);
}

if (problems.length > 0) {
  console.error(`verify:dist encontrou ${problems.length} problema(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`verify:dist ok: ${COMMANDS.length} comandos, ${WEB_FILES.length} arquivos do app, pacote do npm completo.`);
