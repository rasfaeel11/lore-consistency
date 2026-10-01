import { describe, expect, it } from "vitest";
import { estimateTokens } from "../../src/core/tokens.js";

describe("estimateTokens", () => {
  it("texto vazio custa zero", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("conta cerca de 1 token a cada 3 caracteres, arredondando para cima", () => {
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcd")).toBe(2);
    expect(estimateTokens("a".repeat(300))).toBe(100);
  });
});
