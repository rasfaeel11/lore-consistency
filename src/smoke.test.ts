import { describe, expect, it } from "vitest";

// Teste trivial: só prova que o Vitest está configurado e roda.
describe("esqueleto", () => {
  it("roda os testes", () => {
    expect(1 + 1).toBe(2);
  });
});
