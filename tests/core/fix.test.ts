import { describe, expect, it } from "vitest";
import { FIX_FILE, FIX_ID, FIX_START_PROMPT, buildFixRequest } from "../../src/core/fix.js";
import { isSessionId } from "../../src/core/session.js";

describe("pedido de correção do check", () => {
  it("leva o relatório inteiro e as regras contra inventar", () => {
    const request = buildFixRequest("fichas/x.md\n  erro  [id] O id está errado.\n\n1 erro, 0 avisos.\n");

    expect(request).toContain("fichas/x.md\n  erro  [id] O id está errado.");
    expect(request).toContain("sem inventar nada");
    expect(request).toContain("Ficou para o autor");
  });

  it("o prompt de início é uma linha sem caractere que o cmd do Windows interprete", () => {
    expect(FIX_START_PROMPT).toContain(FIX_FILE);
    expect(FIX_START_PROMPT).not.toMatch(/[&|<>^%!"\r\n]/);
  });

  it("o dono da correção não se confunde com uma sessão", () => {
    expect(isSessionId(FIX_ID)).toBe(false);
  });
});
