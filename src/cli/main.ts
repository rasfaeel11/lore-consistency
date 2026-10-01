import { parseArgs } from "node:util";

// Resultado de uma execução da CLI. Quem imprime e encerra o processo é o index.ts.
export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const HELP = `lore-pack: organiza o mundo da sua história e monta o pacote de contexto para a IA.

Uso:
  lore-pack <comando> [opções]

Comandos (ainda em construção):
  init     cria a pasta da história a partir dos modelos
  check    valida as fichas
  pack     monta o pacote de contexto de uma cena

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

  const command = parsed.positionals[0];

  if (parsed.values.help || command === undefined) {
    return ok(HELP);
  }

  return fail(
    `Comando desconhecido: "${command}".\nRode "lore-pack --help" para ver os comandos.`,
  );
}

function ok(stdout: string): CliResult {
  return { exitCode: 0, stdout, stderr: "" };
}

function fail(message: string): CliResult {
  return { exitCode: 1, stdout: "", stderr: `${message}\n` };
}
