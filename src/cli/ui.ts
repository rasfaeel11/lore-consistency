import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { createAppServer, listen } from "../server/app.js";
import { openBrowser } from "./open-browser.js";
import { fail, ok, type CliResult } from "./result.js";
import { findStoryRoot } from "./story-files.js";

const DEFAULT_PORT = 4777;

const USAGE = `Uso:
  lore-pack ui [pasta] [--porta <número>]

Abre o app da história no navegador: capítulos e sessões na barra lateral,
e um formulário para criar sessão nova. Só funciona neste computador (127.0.0.1).
O endereço leva um token novo a cada vez; sem ele, o app não responde.

Opções:
  --porta <número>   porta do servidor (padrão: ${DEFAULT_PORT})
  -h, --help         mostra esta ajuda
`;

// Diferente dos outros comandos, este deixa um servidor rodando. O server volta junto
// para quem chamou poder fechá-lo (os testes fecham; a CLI deixa aberto até o Ctrl+C).
// open abre o navegador; os testes passam uma função que só anota o endereço.
export async function ui(
  args: string[],
  open: (url: string) => void = openBrowser,
): Promise<{ result: CliResult; server?: Server }> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { porta: { type: "string" }, help: { type: "boolean", short: "h" } },
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: fail(`${message}\nRode "lore-pack ui --help" para ver as opções.`) };
  }
  if (parsed.values.help) return { result: ok(USAGE) };

  const portText = parsed.values.porta ?? String(DEFAULT_PORT);
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port > 65535) {
    return { result: fail(`--porta precisa ser um número entre 0 e 65535, por exemplo: --porta ${DEFAULT_PORT}`) };
  }

  const story = findStoryRoot(parsed.positionals[0] ?? ".");
  if (!story.ok) return { result: fail(story.error) };

  // Segredo de uso único: só quem viu o endereço impresso (ou aberto no navegador) entra.
  const token = randomBytes(24).toString("base64url");
  const server = createAppServer(story.root, token);
  let base;
  try {
    base = await listen(server, port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      return {
        result: fail(`A porta ${port} já está em uso (talvez o app já esteja aberto). Feche o outro ou escolha outra com --porta.`),
      };
    }
    throw error;
  }

  const url = `${base}/?token=${token}`;
  open(url);
  return {
    server,
    result: ok(`App da história "${basename(story.root)}" aberto em:
  ${url}
Se o navegador não abrir sozinho, copie esse endereço (com o token). Para encerrar, aperte Ctrl+C aqui no terminal.
`),
  };
}
