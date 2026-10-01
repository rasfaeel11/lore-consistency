import { normalize } from "./normalize.js";

// O que findMentions precisa saber de cada ficha.
export type Nameable = {
  id: string;
  nome: string;
  aliases: string[];
};

// Uma ficha citada no texto e os nomes/aliases que casaram (como estão escritos na ficha).
export type Mention = {
  id: string;
  matched: string[];
};

type Match = {
  id: string;
  term: string;
  start: number;
  end: number;
};

// Procura o nome e os aliases de cada ficha no texto, sem diferenciar maiúsculas e acentos.
export function findMentions(text: string, fichas: Nameable[]): Mention[] {
  return findTerms(
    text,
    fichas.map((ficha) => ({ id: ficha.id, terms: [ficha.nome, ...ficha.aliases] })),
  );
}

// A mesma busca, para qualquer lista de termos (as referências usam as palavras-chave).
export function findTerms(text: string, items: { id: string; terms: string[] }[]): Mention[] {
  const normalizedText = normalize(text);

  const matches: Match[] = [];
  for (const item of items) {
    for (const term of item.terms) {
      for (const [start, end] of findTerm(normalizedText, term)) {
        matches.push({ id: item.id, term, start, end });
      }
    }
  }

  // Um trecho dentro de outro maior que também casou não vale ("Sal" dentro de "Porto Sal").
  const kept = matches.filter(
    (m) => !matches.some((n) => n.start <= m.start && n.end >= m.end && n.end - n.start > m.end - m.start),
  );

  const mentions: Mention[] = [];
  for (const item of items) {
    const matched = item.terms.filter((term) => kept.some((m) => m.id === item.id && m.term === term));
    const unique = [...new Set(matched)];
    if (unique.length > 0) mentions.push({ id: item.id, matched: unique });
  }
  return mentions;
}

// Devolve [início, fim] de cada ocorrência do termo como palavra inteira.
function findTerm(normalizedText: string, term: string): [number, number][] {
  const words = normalize(term).trim().split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return [];

  // Escapa caracteres especiais de regex e aceita qualquer espaço (inclusive quebra de linha) entre palavras.
  const body = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  // Limite de palavra feito à mão: \b do JavaScript não entende letras acentuadas.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "gu");

  return [...normalizedText.matchAll(pattern)].map((m) => [m.index, m.index + m[0].length]);
}
