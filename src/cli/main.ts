import { parseArgs } from "node:util";
import { check } from "./check.js";
import { init } from "./init.js";
import { fail, ok, type CliResult } from "./result.js";

const HELP = `lore-pack: organiza o mundo da sua história e monta o pacote de contexto para a IA.

Uso:
  lore-pack <comando> [opções]

Comandos:
  init <pasta>     cria a pasta da história a partir dos modelos
  check [pasta]    valida as fichas (padrão: a pasta atual)
  pack             monta o pacote de contexto de uma cena (em breve)

Opções:
  -h, --help       mostra esta ajuda
  -v, --version    mostra a versão
`;

export function main(args: string[], version: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
    });
  } catch (error) {
    // parseArgs lança erro para opção desconhecida (ex.: --voar).
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack --help" para ver as opções.`);
  }

  if (parsed.values.version) {
    return ok(`${version}\n`);
  }

  const [command, ...rest] = parsed.positionals;

  if (parsed.values.help || command === undefined) {
    return ok(HELP);
  }

  switch (command) {
    case "init":
      return init(rest[0]);
    case "check":
      return check(rest[0]);
    default:
      return fail(
        `Comando desconhecido: "${command}".\nRode "lore-pack --help" para ver os comandos.`,
      );
  }
}
