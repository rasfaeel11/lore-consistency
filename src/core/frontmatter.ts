import { parse, YAMLError } from "yaml";

// Resultado da separação: ou deu certo (cabeçalho + corpo) ou temos uma mensagem de erro.
export type FrontmatterResult =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; error: string };

const DELIMITER = "---";

// Separa o cabeçalho YAML (entre duas linhas "---") do corpo markdown.
// Nunca lança exceção: problemas viram { ok: false, error }.
export function splitFrontmatter(text: string): FrontmatterResult {
  const content = text.startsWith("﻿") ? text.slice(1) : text;
  // Mantém as quebras de linha originais em cada linha para o corpo sair intacto.
  const lines = content.split(/(?<=\n)/);

  if (lines[0]?.trimEnd() !== DELIMITER) {
    return {
      ok: false,
      error:
        'O arquivo não começa com um cabeçalho YAML. A primeira linha precisa ser "---", seguida dos campos e de outra linha "---".',
    };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trimEnd() === DELIMITER,
  );
  if (closingIndex === -1) {
    return {
      ok: false,
      error:
        'O cabeçalho YAML não tem a linha "---" de fechamento. Adicione uma linha "---" depois do último campo.',
    };
  }

  const yamlText = lines.slice(1, closingIndex).join("");
  const body = lines.slice(closingIndex + 1).join("");

  let data: unknown;
  try {
    data = parse(yamlText);
  } catch (error) {
    if (error instanceof YAMLError) {
      // A linha do erro é contada dentro do YAML; +1 por causa da linha "---" de abertura.
      const line = error.linePos ? ` (linha ${error.linePos[0].line + 1})` : "";
      return {
        ok: false,
        error: `O cabeçalho YAML tem um erro de sintaxe${line}: ${error.message}`,
      };
    }
    throw error;
  }

  if (data === null || data === undefined) {
    return { ok: false, error: "O cabeçalho YAML está vazio. Preencha pelo menos id, tipo e nome." };
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      error: 'O cabeçalho YAML precisa ser uma lista de campos no formato "campo: valor".',
    };
  }

  return { ok: true, data: data as Record<string, unknown>, body };
}
