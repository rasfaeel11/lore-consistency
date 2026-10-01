import { describe, expect, it } from "vitest";
import { splitFrontmatter } from "../../src/core/frontmatter.js";

describe("splitFrontmatter", () => {
  it("separa o cabeçalho YAML do corpo", () => {
    const result = splitFrontmatter("---\nid: ana\nnome: Ana\n---\nCorpo da ficha.\n");

    expect(result).toEqual({
      ok: true,
      data: { id: "ana", nome: "Ana" },
      body: "Corpo da ficha.\n",
    });
  });

  it("aceita quebras de linha do Windows (CRLF)", () => {
    const result = splitFrontmatter("---\r\nid: ana\r\n---\r\nCorpo\r\n");

    expect(result).toEqual({ ok: true, data: { id: "ana" }, body: "Corpo\r\n" });
  });

  it("aceita arquivo sem corpo", () => {
    const result = splitFrontmatter("---\nid: ana\n---");

    expect(result).toEqual({ ok: true, data: { id: "ana" }, body: "" });
  });

  it("ignora o BOM que alguns editores colocam no início", () => {
    const result = splitFrontmatter("﻿---\nid: ana\n---\n");

    expect(result.ok).toBe(true);
  });

  it("arquivo sem frontmatter devolve erro descritivo", () => {
    const result = splitFrontmatter("# Ana\nSó corpo.\n");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("---");
  });

  it("frontmatter sem a linha --- de fechamento devolve erro descritivo", () => {
    const result = splitFrontmatter("---\nid: ana\nnome: Ana\n\nCorpo sem fechar.\n");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("fechamento");
  });

  it("YAML inválido devolve erro descritivo em vez de lançar exceção", () => {
    const result = splitFrontmatter("---\nid: ana\nnome: [Ana\n---\n");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("YAML");
  });

  it("cabeçalho vazio devolve erro", () => {
    const result = splitFrontmatter("---\n---\nCorpo\n");

    expect(result.ok).toBe(false);
  });

  it("cabeçalho que não é uma lista de campos devolve erro", () => {
    const result = splitFrontmatter("---\n- um\n- dois\n---\n");

    expect(result.ok).toBe(false);
  });
});
