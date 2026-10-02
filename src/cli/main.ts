import { parseArgs } from "node:util";
import { findCommand, helpText } from "./commands.js";
import { fail, ok, type CliResult } from "./result.js";

// Despacha os comandos síncronos da lista. Os assíncronos (ui) são chamados pelo index.ts.
export function main(args: string[], version: string): CliResult {
  const command = findCommand(args[0]);
  if (command && "run" in command) return command.run(args.slice(1));
  if (command) return fail(`O comando "${command.name}" só roda pelo lore-pack na linha de comando.`);

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

  const name = parsed.positionals[0];
  if (parsed.values.help || name === undefined) {
    return ok(helpText());
  }

  return fail(`Comando desconhecido: "${name}".\nRode "lore-pack --help" para ver os comandos.`);
}
