import { spawn } from "node:child_process";

// Só o endereço que o próprio ui monta: 127.0.0.1, porta e token em base64url.
// No Windows a URL passa pelo cmd (o start é um comando interno dele), então
// nenhum caractere especial do cmd (&, |, ^, aspas...) pode chegar até lá.
const APP_URL = /^http:\/\/127\.0\.0\.1:\d{1,5}\/\?token=[A-Za-z0-9_-]+$/;

// Qual programa abre o navegador padrão em cada sistema. Função pura, para dar para testar.
export function browserCommand(
  platform: NodeJS.Platform,
  url: string,
): { command: string; args: string[] } | undefined {
  if (!APP_URL.test(url)) return undefined;
  // O primeiro argumento entre aspas do start é o título da janela; o "" vazio evita
  // que a URL seja lida como título.
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
  if (platform === "darwin") return { command: "open", args: [url] };
  return { command: "xdg-open", args: [url] };
}

// Tenta abrir o navegador sem esperar nem falhar: se não abrir, a URL já foi impressa.
export function openBrowser(url: string): void {
  const found = browserCommand(process.platform, url);
  if (!found) return;
  try {
    const child = spawn(found.command, found.args, { stdio: "ignore", detached: true, windowsHide: true });
    // Programa inexistente (ex.: Linux sem xdg-open) vira evento de erro; ignoramos.
    child.on("error", () => {});
    child.unref();
  } catch {
    // Idem: o usuário copia a URL impressa.
  }
}
