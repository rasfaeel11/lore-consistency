import { z } from "zod";

// Configuração do terminal embutido, lida de lore-pack.config.json na pasta da história.
// Regra de segurança: comando e argumentos vêm SÓ deste arquivo. Nada que chega pelo
// navegador (HTTP ou WebSocket) escolhe o que roda.
export const CONFIG_FILE = "lore-pack.config.json";
export const PROMPT_MARKER = "{{prompt}}";
// Valor de terminal.comando que desliga o terminal (sobra o botão de copiar o pacote).
export const NO_TERMINAL = "nenhum";

const DEFAULT_ARGS = [PROMPT_MARKER];
const EXAMPLE = `{ "terminal": { "comando": "claude", "args": ["${PROMPT_MARKER}"] } }`;

const terminalSchema = z.strictObject({
  comando: z
    .string({ error: '"terminal.comando" precisa ser um texto, por exemplo: "claude".' })
    .trim()
    .min(1, { error: '"terminal.comando" está vazio. Use, por exemplo, "claude", ou "nenhum" para desligar o terminal.' }),
  args: z
    .array(z.string(), {
      error: `"terminal.args" precisa ser uma lista de textos, por exemplo: ["${PROMPT_MARKER}"].`,
    })
    .default(DEFAULT_ARGS),
});

// Outros programas que o app pode abrir além do padrão (outra IA, um shell). Cada um tem um
// nome, que é o que aparece na página e a única coisa que o navegador manda para escolher.
const otherSchema = z.strictObject({
  nome: z
    .string({ error: 'Cada item de "outros_terminais" precisa de um "nome" (texto), por exemplo: "Antigravity".' })
    .trim()
    .min(1, { error: 'Um item de "outros_terminais" está com o "nome" vazio.' }),
  comando: z
    .string({ error: 'Cada item de "outros_terminais" precisa de um "comando" (texto), por exemplo: "agy".' })
    .trim()
    .min(1, { error: 'Um item de "outros_terminais" está com o "comando" vazio.' }),
  args: z
    .array(z.string(), { error: `Em "outros_terminais", "args" precisa ser uma lista de textos, por exemplo: ["${PROMPT_MARKER}"].` })
    .default(DEFAULT_ARGS),
});

const configSchema = z.strictObject({
  terminal: terminalSchema.default({ comando: "claude", args: DEFAULT_ARGS }),
  outros_terminais: z
    .array(otherSchema, { error: '"outros_terminais" precisa ser uma lista, por exemplo: [{ "nome": "Antigravity", "comando": "agy" }].' })
    .default([]),
});

export type TerminalConfig = z.infer<typeof terminalSchema>;
export type TerminalChoice = z.infer<typeof otherSchema>;

export type ParsedConfig = { ok: true; terminal: TerminalConfig; others: TerminalChoice[] } | { ok: false; error: string };

// Os programas que dá para abrir, com o padrão primeiro. O nome do padrão é o próprio comando.
// Com o padrão em "nenhum", sobram só os outros; lista vazia é terminal desligado.
export function terminalChoices(config: { terminal: TerminalConfig; others: TerminalChoice[] }): TerminalChoice[] {
  const { comando, args } = config.terminal;
  const main = comando === NO_TERMINAL ? [] : [{ nome: comando, comando, args }];
  return [...main, ...config.others];
}

// Sem arquivo (undefined), vale o padrão. Erro sempre diz o arquivo e como consertar.
export function parseTerminalConfig(text: string | undefined): ParsedConfig {
  if (text === undefined) return { ok: true, terminal: { comando: "claude", args: [...DEFAULT_ARGS] }, others: [] };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `${CONFIG_FILE} não é um JSON válido. Confira vírgulas e aspas. Exemplo: ${EXAMPLE}`,
    };
  }

  const parsed = configSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    let message = issue?.message ?? "formato inválido";
    if (issue?.code === "unrecognized_keys") {
      const where = issue.path.length > 0 ? ` em "${issue.path.join(".")}"` : "";
      message = `Campo desconhecido${where}: ${issue.keys.map((key) => `"${key}"`).join(", ")}. Os campos são "terminal.comando", "terminal.args" e "outros_terminais" (lista de "nome", "comando" e "args").`;
      // Engano comum: escrever "comando" e "args" soltos, sem o "terminal" em volta.
      if (issue.path.length === 0 && issue.keys.some((key) => key === "comando" || key === "args")) {
        message = `"comando" e "args" ficam dentro de "terminal". Deixe o arquivo assim (com o seu comando): ${EXAMPLE}`;
      }
    }
    return { ok: false, error: `${CONFIG_FILE}: ${message}` };
  }
  const config = { terminal: parsed.data.terminal, others: parsed.data.outros_terminais };
  // O nome é como a página escolhe o programa: dois iguais, e um deles nunca abriria.
  const names = terminalChoices(config).map((choice) => choice.nome);
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated !== undefined) {
    return { ok: false, error: `${CONFIG_FILE}: o nome "${repeated}" aparece mais de uma vez (em "outros_terminais" ou igual ao "terminal.comando"). Dê um nome diferente a cada um.` };
  }
  return { ok: true, ...config };
}

// Troca {{prompt}} em cada argumento. Cada item continua sendo um argumento só:
// nada é juntado numa linha de comando de shell.
// Sem prompt (conversa livre), os argumentos que só existem para levar o prompt saem.
export function fillArgs(args: string[], prompt: string): string[] {
  if (prompt === "") return args.filter((arg) => !arg.includes(PROMPT_MARKER));
  return args.map((arg) => arg.split(PROMPT_MARKER).join(prompt));
}
