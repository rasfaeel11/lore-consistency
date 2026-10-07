import { parseArgs } from "node:util";
import { abrir } from "./abrir.js";
import { apply } from "./apply.js";
import { capitulo } from "./capitulo.js";
import { check } from "./check.js";
import { init } from "./init.js";
import { atualizarInstrucoes } from "./instrucoes.js";
import { pack } from "./pack.js";
import { fail, ok, type CliResult } from "./result.js";
import { sessao } from "./sessao.js";
import { ui } from "./ui.js";
import { stopOnExit } from "../server/app.js";

// A única lista de comandos. O --help é montado dela, o main despacha os síncronos
// e o index.ts despacha os assíncronos. Comando novo entra aqui e em nenhum outro lugar.
type CommandInfo = { name: string; usage: string; summary: string };
export type Command =
  | (CommandInfo & { run: (args: string[]) => CliResult })
  | (CommandInfo & { runAsync: (args: string[]) => Promise<CliResult> });

export const COMMANDS: Command[] = [
  {
    name: "init",
    usage: "init <pasta>",
    summary: "cria a pasta da história a partir dos modelos",
    run: (args) => withFolder(args, init),
  },
  {
    name: "check",
    usage: "check [pasta]",
    summary: "valida as fichas (padrão: a pasta atual)",
    run: (args) => withFolder(args, check),
  },
  {
    name: "pack",
    usage: "pack --cena <plano.md> [pasta]",
    summary: 'monta o pacote de contexto da sessão (veja "lore-pack pack --help")',
    run: pack,
  },
  {
    name: "capitulo",
    usage: 'capitulo novo "<título>" [pasta]',
    summary: "cria o próximo capítulo em capitulos/",
    run: capitulo,
  },
  {
    name: "sessao",
    usage: "sessao nova | listar | fechar | verificar",
    summary: 'abre, lista, fecha e verifica sessões de escrita (veja "lore-pack sessao --help")',
    run: sessao,
  },
  {
    name: "apply",
    usage: "apply <id-da-sessão> [--aplicar <números|todas>]",
    summary: 'mostra as mudanças do fechamento e aplica as que você escolher (veja "lore-pack apply --help")',
    run: apply,
  },
  {
    name: "atualizar-instrucoes",
    usage: "atualizar-instrucoes [pasta]",
    summary: 'atualiza o CLAUDE.md, o AGENTS.md e o .claude/settings.json da história (veja "--help")',
    run: atualizarInstrucoes,
  },
  {
    name: "abrir",
    usage: "abrir [pasta]",
    summary: "abre a pasta da história no gerenciador de arquivos",
    run: (args) => abrir(args),
  },
  {
    // Deixa um servidor rodando, por isso é assíncrono.
    name: "ui",
    usage: "ui [pasta]",
    summary: 'abre o app da história no navegador (veja "lore-pack ui --help")',
    runAsync: async (args) => {
      const { result, server } = await ui(args);
      if (server) stopOnExit(server);
      return result;
    },
  },
];

export function findCommand(name: string | undefined): Command | undefined {
  return COMMANDS.find((command) => command.name === name);
}

export function helpText(): string {
  // Uso curto na mesma linha; uso longo ganha linha própria, com o resumo embaixo.
  const lines = COMMANDS.map(({ usage, summary }) =>
    usage.length <= 15 ? `  ${usage.padEnd(17)}${summary}` : `  ${usage}\n${" ".repeat(19)}${summary}`,
  );
  return `lore-pack: organiza o mundo da sua história e monta o pacote de contexto para a IA.

Uso:
  lore-pack <comando> [opções]

Comandos:
${lines.join("\n")}

Opções:
  -h, --help       mostra esta ajuda
  -v, --version    mostra a versão
`;
}

// init e check só recebem a pasta. Aceitam --help e recusam opção desconhecida.
function withFolder(args: string[], command: (folder: string | undefined) => CliResult): CliResult {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { help: { type: "boolean", short: "h" } }, allowPositionals: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${message}\nRode "lore-pack --help" para ver as opções.`);
  }
  if (parsed.values.help) return ok(helpText());
  return command(parsed.positionals[0]);
}
