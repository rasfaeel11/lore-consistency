import { posix, win32 } from "node:path";
import { CONFIG_FILE } from "../core/terminal-config.js";

export type ResolvedCommand = { path: string; batch: boolean };

// Acha o executável do comando configurado, como o terminal faria, mas antes de rodar:
// assim dá para dizer "não achei o claude" em vez de um erro obscuro do sistema.
// No Windows, o nome sem extensão é procurado com cada extensão do PATHEXT (.exe, .cmd...),
// porque o node-pty chama o CreateProcess, que não faz essa busca sozinho.
// exists é recebido de fora para os testes simularem qualquer sistema.
export function resolveCommand(
  command: string,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  exists: (path: string) => boolean,
): ResolvedCommand | undefined {
  const isWindows = platform === "win32";
  const path = isWindows ? win32 : posix;
  const extensions = isWindows ? windowsExtensions(env) : [""];

  const tryPath = (base: string): ResolvedCommand | undefined => {
    // Nome que já tem extensão conhecida vale como está; sem extensão, tenta cada uma.
    const hasExtension = isWindows && extensions.includes(path.extname(base).toUpperCase());
    for (const extension of hasExtension ? [""] : extensions) {
      const candidate = base + extension.toLowerCase();
      if (exists(candidate)) return { path: candidate, batch: isWindows && /\.(cmd|bat)$/i.test(candidate) };
    }
    return undefined;
  };

  // Com separador de pasta, é um caminho: não procura no PATH.
  if (command.includes("/") || (isWindows && command.includes("\\"))) return tryPath(command);

  for (const dir of pathDirs(env, isWindows)) {
    const found = tryPath(path.join(dir, command));
    if (found) return found;
  }
  return undefined;
}

// .cmd e .bat rodam pelo cmd.exe, que interpreta &, |, >, ^, % e outros dentro dos argumentos.
// Os argumentos vêm só do lore-pack.config.json e da instrução de início, mas mesmo assim
// recusamos esses caracteres: melhor um erro claro do que um comando a mais rodando.
const CMD_SPECIAL = /[&|<>^%!"\r\n]/;

export function batchArgsProblem(args: string[]): string | undefined {
  const bad = args.find((arg) => CMD_SPECIAL.test(arg));
  if (bad === undefined) return undefined;
  const char = CMD_SPECIAL.exec(bad)?.[0] ?? "";
  return `O comando configurado é um .cmd ou .bat, que roda pelo cmd do Windows, e um argumento tem o caractere ${JSON.stringify(char)}, que o cmd interpretaria. Tire esse caractere de "terminal.args" no ${CONFIG_FILE}, ou aponte "terminal.comando" para um .exe.`;
}

function windowsExtensions(env: Record<string, string | undefined>): string[] {
  const value = envValue(env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
  return value
    .split(";")
    .map((ext) => ext.trim().toUpperCase())
    .filter((ext) => ext.startsWith("."));
}

function pathDirs(env: Record<string, string | undefined>, isWindows: boolean): string[] {
  const value = envValue(env, "PATH") ?? "";
  return value.split(isWindows ? ";" : ":").filter((dir) => dir.trim() !== "");
}

// No Windows o nome da variável não diferencia maiúsculas ("Path" ou "PATH").
function envValue(env: Record<string, string | undefined>, name: string): string | undefined {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}
