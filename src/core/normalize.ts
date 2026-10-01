// Minúsculas e sem acentos, para comparar nomes ("Capitão" e "capitao" ficam iguais).
// NFD separa a letra do acento ("ã" vira "a" + "~"); depois removemos os acentos soltos.
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
