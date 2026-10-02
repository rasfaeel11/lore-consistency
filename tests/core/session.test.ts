import { describe, expect, it } from "vitest";
import { splitFrontmatter } from "../../src/core/frontmatter.js";
import {
  buildStartPrompt,
  buildSessionFilesBlock,
  closeSession,
  isSessionId,
  listSessions,
  newSessionFile,
  nextSessionId,
  readSession,
  sessionSchema,
} from "../../src/core/session.js";

function sessao(id: string, capitulo: string, status: string, extra: string[] = []) {
  return {
    path: `sessoes/${id}/sessao.md`,
    content: [
      "---",
      `id: ${id}`,
      `capitulo: ${capitulo}`,
      "criada_em: 2026-10-01T12:00:00.000Z",
      `status: ${status}`,
      ...extra,
      "---",
      "## Plano",
      "",
    ].join("\n"),
  };
}

describe("sessionSchema", () => {
  const valid = {
    id: "2026-10-01-cap-03-01",
    capitulo: "cap-03",
    criada_em: "2026-10-01T12:00:00.000Z",
    status: "aberta",
  };

  it("aceita uma sessão aberta", () => {
    expect(sessionSchema.safeParse(valid).success).toBe(true);
  });

  it("recusa status desconhecido", () => {
    expect(sessionSchema.safeParse({ ...valid, status: "pausada" }).success).toBe(false);
  });

  it("recusa data que não é ISO", () => {
    expect(sessionSchema.safeParse({ ...valid, criada_em: "ontem" }).success).toBe(false);
  });

  it("sessão fechada precisa de fechada_em", () => {
    const parsed = sessionSchema.safeParse({ ...valid, status: "fechada" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["fechada_em"]);
  });

  it("recusa id fora do padrão data-capítulo-sequência", () => {
    expect(sessionSchema.safeParse({ ...valid, id: "sessao-1" }).success).toBe(false);
  });
});

describe("listSessions", () => {
  it("agrupa por capítulo, em ordem, com o status de cada sessão", () => {
    const groups = listSessions([
      sessao("2026-10-02-cap-10-01", "cap-10", "aberta"),
      sessao("2026-10-01-cap-02-02", "cap-02", "aberta"),
      sessao("2026-10-01-cap-02-01", "cap-02", "fechada", ["fechada_em: 2026-10-01T15:00:00.000Z"]),
      { path: "sessoes/2026-10-01-cap-02-01/pacote.md", content: "pacote" },
    ]);

    expect(groups.map((g) => g.capitulo)).toEqual(["cap-02", "cap-10"]);
    expect(groups[0]?.sessions.map((s) => [s.id, s.status])).toEqual([
      ["2026-10-01-cap-02-01", "fechada"],
      ["2026-10-01-cap-02-02", "aberta"],
    ]);
  });

  it("deixa de fora sessões com cabeçalho inválido (o check acusa)", () => {
    const groups = listSessions([
      { path: "sessoes/quebrada/sessao.md", content: "sem cabeçalho" },
      sessao("2026-10-01-cap-01-01", "cap-01", "aberta"),
    ]);

    expect(groups).toHaveLength(1);
  });
});

describe("nextSessionId", () => {
  // Mês começa em 0 no Date: 9 é outubro. Hora local, para não depender do fuso.
  const now = new Date(2026, 9, 1, 22, 30);

  it("primeira sessão do capítulo termina em -01, com a data local", () => {
    expect(nextSessionId("cap-03", [], now)).toBe("2026-10-01-cap-03-01");
  });

  it("a sequência conta as sessões do capítulo, mesmo em outros dias", () => {
    const existing = ["2026-09-20-cap-03-01", "2026-09-28-cap-03-02", "2026-09-30-cap-04-05"];

    expect(nextSessionId("cap-03", existing, now)).toBe("2026-10-01-cap-03-03");
  });

  it("não confunde cap-1 com cap-10", () => {
    expect(nextSessionId("cap-1", ["2026-09-20-cap-10-04"], now)).toBe("2026-10-01-cap-1-01");
  });

  it("não colide com nenhum id existente", () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(nextSessionId("cap-02", ids, now));

    expect(new Set(ids).size).toBe(5);
  });
});

describe("newSessionFile", () => {
  it("gera um sessao.md válido com o plano no corpo", () => {
    const text = newSessionFile({
      id: "2026-10-01-cap-03-01",
      capitulo: "cap-03",
      criada_em: "2026-10-01T12:00:00.000Z",
      plano: "Ana encontra Brum.\n",
    });

    const split = splitFrontmatter(text);
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(sessionSchema.parse(split.data).status).toBe("aberta");
    expect(split.body).toContain("## Plano\n\nAna encontra Brum.\n");
  });
});

describe("closeSession", () => {
  const open = newSessionFile({
    id: "2026-10-01-cap-03-01",
    capitulo: "cap-03",
    criada_em: "2026-10-01T12:00:00.000Z",
    plano: "Ana encontra Brum.",
  });

  it("marca como fechada, grava fechada_em e mantém o corpo", () => {
    const result = closeSession(open, "2026-10-01T18:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const split = splitFrontmatter(result.content);
    if (!split.ok) throw new Error(split.error);
    expect(split.data).toMatchObject({ status: "fechada", fechada_em: "2026-10-01T18:00:00.000Z" });
    expect(split.body).toContain("Ana encontra Brum.");
    expect(split.body).not.toContain("## Resumo");
  });

  it("com resumo, acrescenta a seção ## Resumo", () => {
    const result = closeSession(open, "2026-10-01T18:00:00.000Z", "Ana descobriu o mapa.");

    expect(result.ok && result.content.endsWith("## Resumo\n\nAna descobriu o mapa.\n")).toBe(true);
  });

  it("sessão já fechada vira erro claro", () => {
    const closed = closeSession(open, "2026-10-01T18:00:00.000Z");
    if (!closed.ok) throw new Error(closed.error);

    const again = closeSession(closed.content, "2026-10-02T09:00:00.000Z");

    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("já está fechada");
  });
});

describe("buildStartPrompt", () => {
  it("pede para ler o pacote, escrever só no rascunho e no fechamento da sessão", () => {
    expect(buildStartPrompt("2026-10-01-cap-03-01")).toBe(
      "Leia o arquivo sessoes/2026-10-01-cap-03-01/pacote.md e siga as instruções dele. Escreva o texto das cenas em sessoes/2026-10-01-cap-03-01/rascunho.md e, ao final, as propostas de mudança em sessoes/2026-10-01-cap-03-01/fechamento.md. Não edite nenhum outro arquivo.",
    );
  });

  it("cabe numa linha e não tem aspas (vai como argumento do comando)", () => {
    const prompt = buildStartPrompt("2026-10-01-cap-03-01");
    expect(prompt).not.toMatch(/["\n]/);
  });
});

describe("buildSessionFilesBlock", () => {
  it("diz onde escrever e proíbe editar o resto, só para quem tem acesso aos arquivos", () => {
    const block = buildSessionFilesBlock("2026-10-01-cap-03-01");

    expect(block.split("\n")[0]).toBe("=== ARQUIVOS DESTA SESSÃO ===");
    expect(block).toContain("Se você consegue ler e escrever arquivos nesta pasta");
    expect(block).toContain("sessoes/2026-10-01-cap-03-01/rascunho.md");
    expect(block).toContain("sessoes/2026-10-01-cap-03-01/fechamento.md");
    expect(block).toContain("prompts-de-sessao/04-fechar-sessao.md");
    expect(block).toContain("Não edite nenhum outro arquivo");
  });
});

describe("isSessionId", () => {
  it("aceita data-capítulo-sequência e recusa o resto", () => {
    expect(isSessionId("2026-10-01-cap-03-01")).toBe(true);
    expect(isSessionId("../biblia")).toBe(false);
    expect(isSessionId("2026-10-01-cap-03")).toBe(false);
  });
});

describe("readSession", () => {
  it("separa o cabeçalho validado do corpo", () => {
    const result = readSession(sessao("2026-10-01-cap-01-01", "cap-01", "aberta").content);

    expect(result).toEqual({
      ok: true,
      session: {
        id: "2026-10-01-cap-01-01",
        capitulo: "cap-01",
        criada_em: "2026-10-01T12:00:00.000Z",
        status: "aberta",
      },
      body: "## Plano\n",
    });
  });

  it("cabeçalho inválido vira erro", () => {
    const result = readSession(sessao("2026-10-01-cap-01-01", "cap-01", "pausada").content);

    expect(result.ok).toBe(false);
  });
});
