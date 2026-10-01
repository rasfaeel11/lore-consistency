import { parseArgs } from "node:util";
import { capitulo } from "./capitulo.js";
import { check } from "./check.js";
import { init } from "./init.js";
import { pack } from "./pack.js";
import { fail, ok, type CliResult } from "./result.js";
import { sessao } from "./sessao.js";

const HELP = `lore-pack: organiza o mundo da sua história e monta o pacote de contexto para a IA.

Uso:
  lore-pack <comando> [opções]

Comandos:
  init <pasta>     cria a pasta da história a partir dos modelos
  check [pasta]    valida as fichas (padrão: a pasta atual)
  pack --cena <plano.md> [pasta]
                   monta o pacote de contexto da sessão (veja "lore-pack pack --help")
  capitulo novo "<título>" [pasta]
                   cria o próximo capítulo em capitulos/
  sessao nova | listar | fechar
                   abre, lista e fecha sessões de escrita (veja "lore-pack sessao --help")
  app [pasta]      abre o app da história no navegador (veja "lore-pack app --help")

Opções:
  -h, --help       mostra esta ajuda
  -v, --version    mostra a versão
`;

export function main(args: string[], version: string): CliResult {
  // Estes comandos têm opções próprias (--cena, --capitulo...), então eles mesmos leem os argumentos.
  if (args[0] === "pack") return pack(args.slice(1));
  if (args[0] === "capitulo") return capitulo(args.slice(1));
  if (args[0] === "sessao") return sessao(args.slice(1));

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
