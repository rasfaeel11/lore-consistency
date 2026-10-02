import { describe, expect, it } from "vitest";
import { compareHashes, diffLines, directChangesEntry, isProtectedPath } from "../../src/core/guard.js";

describe("isProtectedPath", () => {
  it("protege bíblia, estado, alfabeto, fichas, referências e capítulos", () => {
    for (const path of [
      "biblia.md",
      "estado.md",
      "alfabeto.md",
      "fichas/personagens/ana.md",
      "referencias/magia.md",
      "capitulos/cap-01.md",
    ]) {
      expect(isProtectedPath(path), path).toBe(true);
    }
  });

  it("protege as instruções e a configuração que a IA não pode mudar sozinha", () => {
    for (const path of ["CLAUDE.md", "AGENTS.md", ".claude/settings.json", "lore-pack.config.json"]) {
      expect(isProtectedPath(path), path).toBe(true);
    }
  });

  it("não protege sessões (rascunho e fechamento), modelos nem outros arquivos", () => {
    for (const path of [
      "sessoes/2026-10-01-cap-01-01/rascunho.md",
      "sessoes/2026-10-01-cap-01-01/fechamento.md",
      "modelos/ficha-modelo.md",
      "plano.md",
      "fichas-velhas/ana.md",
      ".lore-pack/snapshots/x/arquivos/biblia.md",
    ]) {
      expect(isProtectedPath(path), path).toBe(false);
    }
  });
});

describe("compareHashes", () => {
  it("acha alterado, apagado e criado, em ordem de caminho", () => {
    const before = { "biblia.md": "a", "estado.md": "b", "fichas/x.md": "c" };
    const after = { "biblia.md": "a", "estado.md": "B", "referencias/magia.md": "d" };

    expect(compareHashes(before, after)).toEqual([
      { path: "estado.md", kind: "alterado" },
      { path: "fichas/x.md", kind: "apagado" },
      { path: "referencias/magia.md", kind: "criado" },
    ]);
  });

  it("sem diferença, lista vazia", () => {
    expect(compareHashes({ "biblia.md": "a" }, { "biblia.md": "a" })).toEqual([]);
  });
});

describe("diffLines", () => {
  it("marca linhas tiradas com - e acrescentadas com +", () => {
    expect(diffLines("um\ndois\ntrês\n", "um\nDOIS\ntrês\n")).toBe("  um\n- dois\n+ DOIS\n  três");
  });

  it("arquivo novo é todo +, arquivo apagado é todo -", () => {
    expect(diffLines("", "a\nb\n")).toBe("+ a\n+ b");
    expect(diffLines("a\nb\n", "")).toBe("- a\n- b");
  });

  it("em arquivo longo, mostra só duas linhas de contexto em volta da mudança", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `linha ${i + 1}`);
    const changed = lines.map((line) => (line === "linha 10" ? "linha dez" : line));

    expect(diffLines(lines.join("\n"), changed.join("\n"))).toBe(
      ["…", "  linha 8", "  linha 9", "- linha 10", "+ linha dez", "  linha 11", "  linha 12", "…"].join("\n"),
    );
  });

  it("textos iguais dão diff vazio", () => {
    expect(diffLines("a\n", "a\n")).toBe("");
  });
});

describe("directChangesEntry", () => {
  it("monta uma seção com a data e a lista de arquivos", () => {
    const entry = directChangesEntry(
      [
        { path: "fichas/personagens/ana.md", kind: "alterado" },
        { path: "fichas/lugares/farol.md", kind: "criado" },
      ],
      "2026-10-01T17:30:00.000Z",
    );

    expect(entry).toBe(
      "## 2026-10-01T17:30:00.000Z\n\nO autor decidiu manter estas alterações feitas direto nos arquivos protegidos:\n\n- alterado: fichas/personagens/ana.md\n- criado: fichas/lugares/farol.md\n",
    );
  });
});
