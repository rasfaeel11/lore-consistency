import { describe, expect, it } from "vitest";
import { batchArgsProblem, resolveCommand } from "../../src/server/command.js";

// Sistema de arquivos de mentira: só estes caminhos "existem".
const fakeFs = (paths: string[]) => (path: string) => paths.includes(path);

describe("resolveCommand no Windows", () => {
  const env = { Path: "C:\\bin;C:\\npm", PATHEXT: ".COM;.EXE;.BAT;.CMD" };

  it("procura com as extensões do PATHEXT, na ordem, pasta por pasta", () => {
    const exists = fakeFs(["C:\\npm\\claude.cmd", "C:\\npm\\claude.exe"]);

    expect(resolveCommand("claude", "win32", env, exists)).toEqual({ path: "C:\\npm\\claude.exe", batch: false });
  });

  it(".cmd e .bat são marcados como batch (passam pelo cmd)", () => {
    const exists = fakeFs(["C:\\npm\\gemini.cmd"]);

    expect(resolveCommand("gemini", "win32", env, exists)).toEqual({ path: "C:\\npm\\gemini.cmd", batch: true });
  });

  it("a primeira pasta do PATH ganha", () => {
    const exists = fakeFs(["C:\\bin\\claude.exe", "C:\\npm\\claude.exe"]);

    expect(resolveCommand("claude", "win32", env, exists)?.path).toBe("C:\\bin\\claude.exe");
  });

  it("aceita caminho completo, com ou sem extensão", () => {
    expect(resolveCommand("D:\\ferramentas\\ia.exe", "win32", env, fakeFs(["D:\\ferramentas\\ia.exe"]))?.path).toBe(
      "D:\\ferramentas\\ia.exe",
    );
    expect(resolveCommand("D:\\ferramentas\\ia", "win32", env, fakeFs(["D:\\ferramentas\\ia.cmd"]))).toEqual({
      path: "D:\\ferramentas\\ia.cmd",
      batch: true,
    });
  });

  it("não existe: undefined", () => {
    expect(resolveCommand("claude", "win32", env, fakeFs([]))).toBeUndefined();
  });

  it("sem PATHEXT no ambiente, usa .COM, .EXE, .BAT e .CMD", () => {
    expect(resolveCommand("claude", "win32", { Path: "C:\\npm" }, fakeFs(["C:\\npm\\claude.cmd"]))?.path).toBe(
      "C:\\npm\\claude.cmd",
    );
  });
});

describe("resolveCommand no Linux e macOS", () => {
  const env = { PATH: "/usr/local/bin:/usr/bin" };

  it("procura o nome exato nas pastas do PATH", () => {
    expect(resolveCommand("claude", "linux", env, fakeFs(["/usr/bin/claude"]))).toEqual({
      path: "/usr/bin/claude",
      batch: false,
    });
  });

  it("caminho completo existente é aceito; inexistente não", () => {
    expect(resolveCommand("/opt/ia/bin/ia", "darwin", env, fakeFs(["/opt/ia/bin/ia"]))?.path).toBe("/opt/ia/bin/ia");
    expect(resolveCommand("/opt/ia/bin/ia", "darwin", env, fakeFs([]))).toBeUndefined();
  });
});

describe("batchArgsProblem", () => {
  it("argumento comum passa", () => {
    expect(batchArgsProblem(["Leia o arquivo sessoes/2026-10-01-cap-03-01/pacote.md. Não edite nada."])).toBeUndefined();
  });

  it("caractere especial do cmd é recusado, dizendo qual", () => {
    for (const arg of ["a & calc", "a | b", "a > b", "100%", "a^b", 'a "b"', "a!b"]) {
      expect(batchArgsProblem([arg]), arg).toContain("lore-pack.config.json");
    }
  });
});
