import { z } from "zod";

// Configuração do terminal embutido, lida de lore-pack.config.json na pasta da história.
// Regra de segurança: comando e argumentos vêm SÓ deste arquivo. Nada que chega pelo
// navegador (HTTP ou WebSocket) escolhe o que roda.
export const CONFIG_FILE = "lore-pack.config.json";
export const PROMPT_MARKER = "{{prompt}}";
// Valor de terminal.comando que desliga o terminal (sobra o botão de copiar o pacote).
export const NO_TERMINAL = "nenhum";

const DEFAULT_ARGS = [PROMPT_MARKER];

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

const configSchema = z.strictObject({
  terminal: terminalSchema.default({ comando: "claude", args: DEFAULT_ARGS }),
});

export type TerminalConfig = z.infer<typeof terminalSchema>;

export type ParsedConfig = { ok: true; terminal: TerminalConfig } | { ok: false; error: string };

// Sem arquivo (undefined), vale o padrão. Erro sempre diz o arquivo e como consertar.
export function parseTerminalConfig(text: string | undefined): ParsedConfig {
  if (text === undefined) return { ok: true, terminal: { comando: "claude", args: [...DEFAULT_ARGS] } };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `${CONFIG_FILE} não é um JSON válido. Confira vírgulas e aspas. Exemplo: { "terminal": { "comando": "claude", "args": ["${PROMPT_MARKER}"] } }`,
    };
  }

  const parsed = configSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    let message = issue?.message ?? "formato inválido";
    if (issue?.code === "unrecognized_keys") {
      const where = issue.path.length > 0 ? ` em "${issue.path.join(".")}"` : "";
      message = `Campo desconhecido${where}: ${issue.keys.map((key) => `"${key}"`).join(", ")}. Os campos são "terminal.comando" e "terminal.args".`;
    }
    return { ok: false, error: `${CONFIG_FILE}: ${message}` };
  }
  return { ok: true, terminal: parsed.data.terminal };
}

// Troca {{prompt}} em cada argumento. Cada item continua sendo um argumento só:
// nada é juntado numa linha de comando de shell.
// Sem prompt (conversa livre), os argumentos que só existem para levar o prompt saem.
export function fillArgs(args: string[], prompt: string): string[] {
  if (prompt === "") return args.filter((arg) => !arg.includes(PROMPT_MARKER));
  return args.map((arg) => arg.split(PROMPT_MARKER).join(prompt));
}
