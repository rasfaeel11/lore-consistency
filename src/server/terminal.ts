import { execFile, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { IPty } from "node-pty";
import type { WebSocket } from "ws";
import { buildStartPrompt } from "../core/session.js";
import { CONFIG_FILE, NO_TERMINAL, fillArgs, parseTerminalConfig } from "../core/terminal-config.js";
import { checkGuard, hasSnapshot, takeSnapshot } from "../cli/guard.js";
import { isFile, readText } from "../cli/story-files.js";
import { batchArgsProblem, resolveCommand, type ResolvedCommand } from "./command.js";

// O node-pty é dependência opcional: se não instalar (sem binário pronto e sem compilador)
// ou não carregar, o app continua funcionando e o terminal aparece desligado.
type PtyModule = typeof import("node-pty");
export type PtyLoad = { ok: true; pty: PtyModule } | { ok: false; reason: string };

export async function loadNodePty(): Promise<PtyLoad> {
  try {
    return { ok: true, pty: await import("node-pty") };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export const MAX_TERMINALS = 4;
// Saída recente guardada para quem reconecta (recarregar a página). Em caracteres.
const BUFFER_LIMIT = 100_000;
const DEFAULT_SIZE = { cols: 120, rows: 30 };
const MAX_SIZE = 1000;
const COPY_HINT = 'Use o botão "Copiar pacote" e cole na IA que preferir.';
// Quanto esperar o processo morrer depois do kill, antes de forçar pelo PID.
const KILL_WAIT_MS = 8000;

type Terminal = {
  id: string;
  sessionId: string;
  pty: IPty;
  buffer: string;
  clients: Set<WebSocket>;
  exitCode: number | null;
  // Resolve quando o processo termina. O kill não espera, e no Windows uma pasta que é
  // diretório de trabalho de um processo vivo nem pode ser apagada.
  exited: Promise<void>;
};

export type TerminalStatus = { ligado: true; comando: string } | { ligado: false; motivo: string };
export type OpenResult = { ok: true; id: string } | { ok: false; status: number; error: string };

// Mensagens que o navegador pode mandar. Nenhuma escolhe comando, pasta ou ambiente.
type ClientMessage = { tipo: "entrada"; dados: string } | { tipo: "tamanho"; colunas: number; linhas: number };

export class TerminalManager {
  private readonly terminals = new Map<string, Terminal>();
  private ptyLoad: Promise<PtyLoad> | undefined;

  constructor(
    private readonly root: string,
    private readonly loadPty: () => Promise<PtyLoad>,
  ) {}

  // O motivo de estar desligado aparece na tela, então diz o que fazer.
  async status(): Promise<TerminalStatus> {
    const ready = await this.prepare();
    return ready.ok ? { ligado: true, comando: ready.command.path } : { ligado: false, motivo: ready.error };
  }

  async open(sessionId: string): Promise<OpenResult> {
    const ready = await this.prepare();
    if (!ready.ok) return { ok: false, status: ready.status, error: ready.error };

    const args = fillArgs(ready.args, buildStartPrompt(sessionId));
    if (ready.command.batch) {
      const problem = batchArgsProblem(args);
      if (problem) return { ok: false, status: 409, error: problem };
    }
    if (this.running() >= MAX_TERMINALS) {
      return {
        ok: false,
        status: 429,
        error: `Já há ${MAX_TERMINALS} terminais abertos, o máximo. Feche um deles antes de abrir outro.`,
      };
    }

    // Guarda do cânone: sessão sem snapshot passa a ser vigiada agora. Se já tem, mantém o
    // existente: tirar outro apagaria uma mudança ainda não resolvida.
    if (!hasSnapshot(this.root, sessionId)) takeSnapshot(this.root, sessionId);

    let pty: IPty;
    try {
      // Argumentos em lista, pasta da história como diretório: nada passa por um shell.
      pty = ready.pty.spawn(ready.command.path, args, {
        name: "xterm-256color",
        ...DEFAULT_SIZE,
        cwd: this.root,
        env: { ...process.env, TERM: "xterm-256color" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, status: 500, error: `Não consegui abrir "${ready.command.path}": ${message}` };
    }

    let markExited = () => {};
    const terminal: Terminal = {
      id: randomBytes(8).toString("hex"),
      sessionId,
      pty,
      buffer: "",
      clients: new Set(),
      exitCode: null,
      exited: new Promise((resolve) => (markExited = resolve)),
    };
    this.terminals.set(terminal.id, terminal);

    pty.onData((data) => {
      terminal.buffer = (terminal.buffer + data).slice(-BUFFER_LIMIT);
      this.broadcast(terminal, { tipo: "saida", dados: data });
    });
    pty.onExit(({ exitCode }) => {
      terminal.exitCode = exitCode;
      markExited();
      this.broadcast(terminal, { tipo: "fim", codigo: exitCode });
      // A IA pode ter mexido em arquivo protegido: compara assim que o processo termina.
      const report = checkGuard(this.root, sessionId);
      if (report) this.broadcast(terminal, { tipo: "guarda", mudancas: report.changes.map((change) => change.path) });
    });

    return { ok: true, id: terminal.id };
  }

  has(id: string): boolean {
    return this.terminals.has(id);
  }

  list() {
    return [...this.terminals.values()].map((t) => ({
      id: t.id,
      sessao: t.sessionId,
      rodando: t.exitCode === null,
      codigo: t.exitCode,
    }));
  }

  // Liga um navegador ao terminal. Quem chega depois recebe a saída recente primeiro.
  attach(id: string, ws: WebSocket): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      ws.close(1008, "terminal inexistente");
      return;
    }
    terminal.clients.add(ws);
    if (terminal.buffer) send(ws, { tipo: "saida", dados: terminal.buffer });
    if (terminal.exitCode !== null) send(ws, { tipo: "fim", codigo: terminal.exitCode });

    ws.on("message", (data) => {
      const message = parseClientMessage(data.toString());
      if (!message || terminal.exitCode !== null) return;
      if (message.tipo === "entrada") terminal.pty.write(message.dados);
      else terminal.pty.resize(message.colunas, message.linhas);
    });
    ws.on("close", () => terminal.clients.delete(ws));
    // Mensagem grande demais e conexão cortada viram "error"; o ws já fecha a conexão sozinho.
    ws.on("error", () => terminal.clients.delete(ws));
  }

  // Fechar a aba do terminal no app: mata o processo, espera ele terminar e esquece o terminal.
  async close(id: string): Promise<boolean> {
    const terminal = this.terminals.get(id);
    if (!terminal) return false;
    this.terminals.delete(id);
    await kill(terminal);
    for (const ws of terminal.clients) ws.close(1000, "terminal fechado");
    return true;
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.terminals.keys()].map((id) => this.close(id)));
  }

  // Última chance, quando o Node já está saindo e não dá para esperar nada.
  killAllNow(): void {
    for (const terminal of this.terminals.values()) forceKill(terminal);
  }

  private running(): number {
    return [...this.terminals.values()].filter((t) => t.exitCode === null).length;
  }

  private broadcast(terminal: Terminal, message: object): void {
    for (const ws of terminal.clients) send(ws, message);
  }

  // Confere tudo o que precisa para abrir um terminal. A configuração é lida do disco a cada
  // vez, então editar o lore-pack.config.json vale sem reiniciar o app.
  private async prepare(): Promise<
    | { ok: true; pty: PtyModule; command: ResolvedCommand; args: string[] }
    | { ok: false; status: number; error: string }
  > {
    this.ptyLoad ??= this.loadPty();
    const load = await this.ptyLoad;
    if (!load.ok) {
      return {
        ok: false,
        status: 503,
        error: `O terminal embutido precisa do pacote node-pty, que não carregou neste computador (${load.reason}). ${COPY_HINT}`,
      };
    }

    const configPath = join(this.root, CONFIG_FILE);
    const config = parseTerminalConfig(isFile(configPath) ? readText(configPath) : undefined);
    if (!config.ok) return { ok: false, status: 409, error: `${config.error} ${COPY_HINT}` };
    const { comando, args } = config.terminal;
    if (comando === NO_TERMINAL) {
      return {
        ok: false,
        status: 409,
        error: `O terminal está desligado: "terminal.comando" é "${NO_TERMINAL}" no ${CONFIG_FILE}. ${COPY_HINT}`,
      };
    }

    const command = resolveCommand(comando, process.platform, process.env, isFile);
    if (!command) {
      return {
        ok: false,
        status: 409,
        error: `O comando "${comando}" não foi encontrado neste computador. Instale a ferramenta de IA (o padrão é o Claude Code, comando "claude") ou troque "terminal.comando" no ${CONFIG_FILE}. ${COPY_HINT}`,
      };
    }
    return { ok: true, pty: load.pty, command, args };
  }
}

function send(ws: WebSocket, message: object): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

// No Windows, o taskkill /T mata a árvore inteira (a IA abre shells e outros processos).
// O pty.kill() do node-pty só pega os processos ligados ao console e ainda imprime
// "AttachConsole failed" no terminal do autor. No Linux e no macOS, o kill manda SIGHUP
// para a sessão do terminal, que leva os filhos junto.
async function kill(terminal: Terminal): Promise<void> {
  if (terminal.exitCode !== null) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(terminal.pty.pid), "/T", "/F"], { windowsHide: true }, () => {});
  } else {
    try {
      terminal.pty.kill();
    } catch {
      // Já tinha terminado entre a checagem e o kill.
    }
  }
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => (timer = setTimeout(() => resolve("timeout"), KILL_WAIT_MS)));
  const result = await Promise.race([terminal.exited, timeout]);
  clearTimeout(timer);
  if (result === "timeout") forceKill(terminal);
}

// Síncrono: serve também quando o Node já está saindo e não dá para esperar nada.
function forceKill(terminal: Terminal): void {
  if (terminal.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(terminal.pty.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      process.kill(terminal.pty.pid, "SIGKILL");
    }
  } catch {
    // Já terminou.
  }
}

// Mensagem inválida é ignorada: não derruba o terminal nem a conexão.
function parseClientMessage(text: string): ClientMessage | undefined {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message.tipo === "entrada" && typeof message.dados === "string") return { tipo: "entrada", dados: message.dados };
  if (message.tipo === "tamanho" && isSize(message.colunas) && isSize(message.linhas)) {
    return { tipo: "tamanho", colunas: message.colunas, linhas: message.linhas };
  }
  return undefined;
}

function isSize(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_SIZE;
}
