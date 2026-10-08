import { describe, expect, it } from "vitest";
import { fillArgs, parseTerminalConfig } from "../../src/core/terminal-config.js";

describe("parseTerminalConfig", () => {
  it("sem arquivo, usa o padrão: claude com o prompt", () => {
    expect(parseTerminalConfig(undefined)).toEqual({ ok: true, terminal: { comando: "claude", args: ["{{prompt}}"] } });
  });

  it("aceita comando e argumentos próprios", () => {
    const text = JSON.stringify({ terminal: { comando: "gemini", args: ["-i", "{{prompt}}"] } });

    expect(parseTerminalConfig(text)).toEqual({ ok: true, terminal: { comando: "gemini", args: ["-i", "{{prompt}}"] } });
  });

  it("args é opcional", () => {
    const text = JSON.stringify({ terminal: { comando: "codex" } });

    expect(parseTerminalConfig(text)).toEqual({ ok: true, terminal: { comando: "codex", args: ["{{prompt}}"] } });
  });

  it('"nenhum" desliga o terminal', () => {
    const result = parseTerminalConfig(JSON.stringify({ terminal: { comando: "nenhum" } }));

    expect(result).toEqual({ ok: true, terminal: { comando: "nenhum", args: ["{{prompt}}"] } });
  });

  it("JSON quebrado: diz o arquivo e o que fazer", () => {
    const result = parseTerminalConfig("{ terminal: ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("lore-pack.config.json");
      expect(result.error).toContain("JSON");
    }
  });

  it("tipo errado: diz o campo", () => {
    const result = parseTerminalConfig(JSON.stringify({ terminal: { comando: 42 } }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("terminal.comando");
  });

  it("comando vazio e args que não é lista dão erro", () => {
    expect(parseTerminalConfig(JSON.stringify({ terminal: { comando: " " } })).ok).toBe(false);

    const result = parseTerminalConfig(JSON.stringify({ terminal: { comando: "claude", args: "{{prompt}}" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("terminal.args");
  });

  it("campo desconhecido (erro de digitação) dá erro com o nome do campo", () => {
    const result = parseTerminalConfig(JSON.stringify({ terminal: { comand: "claude" } }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("comand");
  });
});

describe("comando e args fora de terminal", () => {
  it("o erro diz que eles ficam dentro de terminal e mostra o arquivo certo", () => {
    const result = parseTerminalConfig('{ "comando": "claude", "args": ["{{prompt}}"] }');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('dentro de "terminal"');
    expect(result.error).toContain('{ "terminal": { "comando": "claude", "args": ["{{prompt}}"] } }');
  });
});

describe("fillArgs", () => {
  it("troca {{prompt}} em cada argumento, inclusive no meio do texto", () => {
    expect(fillArgs(["-i", "{{prompt}}", "--msg={{prompt}}"], "Leia o pacote.")).toEqual([
      "-i",
      "Leia o pacote.",
      "--msg=Leia o pacote.",
    ]);
  });

  it("o prompt entra como um argumento só, mesmo com espaços e aspas", () => {
    expect(fillArgs(["{{prompt}}"], 'a b "c"')).toEqual(['a b "c"']);
  });

  it("sem prompt (conversa livre), os argumentos com {{prompt}} saem e os outros ficam", () => {
    expect(fillArgs(["--verbose", "{{prompt}}"], "")).toEqual(["--verbose"]);
    expect(fillArgs(["{{prompt}}"], "")).toEqual([]);
  });
});
