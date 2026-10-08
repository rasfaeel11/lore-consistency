import { describe, expect, it } from "vitest";
import {
  DISCUSSION_FILE,
  DISCUSSION_START_PROMPT,
  TALK_ID,
  buildDiscussionPack,
  buildDiscussionRequest,
  discussionFiles,
} from "../../src/core/discussion.js";
import { isSessionId } from "../../src/core/session.js";

const FILES = [
  { path: "biblia.md", content: "# Bíblia\n\nCidade movida a sal.\n" },
  { path: "estado.md", content: "# Estado\n\nAna chegou ao porto.\n" },
  { path: "alfabeto.md", content: "# Alfabeto\n" },
  { path: "capitulos/cap-01.md", content: "# Chegada\n\nTexto do capítulo.\n" },
  { path: "fichas/personagens/ana.md", content: "---\nid: ana\n---\n# Ana\n" },
  { path: "fichas/lugares/porto.md", content: "---\nid: porto\n---\n# Porto\n" },
  { path: "referencias/magia.md", content: "---\nid: magia\n---\nO Resto.\n" },
  { path: "sessoes/2026-10-01-cap-01-01/sessao.md", content: "plano" },
];

describe("discussão de rumos", () => {
  it("escolhe todas as fichas e todas as referências, sem o autor marcar nada", () => {
    const chosen = discussionFiles(FILES);

    expect(chosen.fichas.map((f) => f.path)).toEqual(["fichas/personagens/ana.md", "fichas/lugares/porto.md"]);
    expect(chosen.referencias.map((f) => f.path)).toEqual(["referencias/magia.md"]);
  });

  it("o pedido do terminal leva o assunto e manda ler a bíblia, o estado e cada ficha e referência", () => {
    const request = buildDiscussionRequest("O que acontece com a Ana?", FILES);

    expect(request).toContain("O que acontece com a Ana?");
    expect(request).toContain("`biblia.md`");
    expect(request).toContain("`estado.md`");
    expect(request).toContain("`fichas/personagens/ana.md`");
    expect(request).toContain("`fichas/lugares/porto.md`");
    expect(request).toContain("`referencias/magia.md`");
    // O terminal lê os arquivos: o texto deles não é copiado para o pedido.
    expect(request).not.toContain("Cidade movida a sal.");
    expect(request).toContain("Espere a decisão do autor");
  });

  it("pasta sem fichas nem referências: o pedido diz que não há", () => {
    const request = buildDiscussionRequest("X", FILES.slice(0, 2));

    expect(request).toContain("Ainda não há fichas");
    expect(request).not.toContain("referencias/");
  });

  it("o pacote para colar em outra IA leva o texto de tudo", () => {
    const pack = buildDiscussionPack("O que acontece com a Ana?", FILES, "MODELO DE FICHA");

    expect(pack).toContain("O que acontece com a Ana?");
    expect(pack).toContain("Cidade movida a sal.");
    expect(pack).toContain("Ana chegou ao porto.");
    expect(pack).toContain("# Ana");
    expect(pack).toContain("# Porto");
    expect(pack).toContain("O Resto.");
    expect(pack).toContain("MODELO DE FICHA");
    // Capítulos e sessões não entram: o estado já resume a história.
    expect(pack).not.toContain("Texto do capítulo.");
  });

  it("o prompt de início é uma linha sem caractere que o cmd do Windows interprete", () => {
    expect(DISCUSSION_START_PROMPT).toContain(DISCUSSION_FILE);
    expect(DISCUSSION_START_PROMPT).not.toMatch(/[&|<>^%!"\r\n]/);
  });

  it("o dono da conversa não se confunde com uma sessão", () => {
    expect(isSessionId(TALK_ID)).toBe(false);
  });
});
