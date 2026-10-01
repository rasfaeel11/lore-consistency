// Estimativa APROXIMADA de tokens: 1 token a cada 3 caracteres.
//
// Cada IA conta tokens de um jeito, e contar de verdade exigiria o tokenizador de cada uma.
// Em inglês a média costuma ficar perto de 4 caracteres por token; em português, com acentos
// e palavras mais longas, ela cai. Usamos 3 de propósito, para errar para cima: é melhor
// o pacote caber com folga do que estourar o limite da conversa.
const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
