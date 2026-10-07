import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/cli/commands.js";
import { main } from "../../src/cli/main.js";

describe("lista de comandos", () => {
  it("todo comando da lista aparece no --help", () => {
    const help = main(["--help"], "0.0.0").stdout;

    for (const command of COMMANDS) {
      expect(help).toContain(`  ${command.usage}`);
    }
  });

  it("todo comando síncrono da lista está registrado no main (responde ao --help)", () => {
    for (const command of COMMANDS.filter((c) => "run" in c)) {
      const result = main([command.name, "--help"], "0.0.0");
      expect(result.stderr, command.name).toBe("");
      expect(result.exitCode, command.name).toBe(0);
    }
  });

  it("a lista tem os comandos esperados, sem repetir nome", () => {
    const names = COMMANDS.map((c) => c.name);

    expect(names).toEqual(["init", "check", "pack", "capitulo", "sessao", "apply", "atualizar-instrucoes", "abrir", "ui"]);
    expect(new Set(names).size).toBe(names.length);
  });
});
