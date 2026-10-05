# Fechamento

1. estado.md: resumo do cap-01 e um setup novo.
2. Fichas: Ana ganhou um fato e mudou de status; ficha nova do faroleiro.
3. alfabeto.md: Tobias Vau.

NÃO APROVADO: o farol ser assombrado.

```lore-pack-mudancas
{
  "operacoes": [
    { "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["cap-01: Ana chega a Porto Sal e conhece o faroleiro."] },
    { "op": "estado_adicionar", "secao": "Setups abertos", "linhas": ["- a lanterna apagada | cap-01 | o faroleiro esconde algo"] },
    { "op": "ficha_adicionar", "id": "ana-ferreira", "secao": "Fatos", "linhas": ["- Conheceu o faroleiro Tobias (cap-01)."] },
    { "op": "ficha_substituir", "id": "ana-ferreira", "antigo": "status: viva", "novo": "status: ferida" },
    { "op": "ficha_criar", "tipo": "personagem", "id": "tobias-vau", "conteudo": "---\nid: tobias-vau\ntipo: personagem\nnome: Tobias Vau\naliases: [o faroleiro]\naparece_em: [cap-01]\n---\n**Essencial (1 linha):** faroleiro de Porto Sal.\n" },
    { "op": "alfabeto_adicionar", "linhas": ["- Tobias Vau | faroleiro | costeiros | cap-01"] },
    { "op": "nao_aprovado", "itens": ["O farol ser assombrado."] }
  ]
}
```
