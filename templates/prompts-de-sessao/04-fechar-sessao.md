Quando usar: no fim de toda sessão, ou quando a conversa ficar longa demais.

## Copie a partir daqui

Fechamento da sessão. Gere APENAS as mudanças nos arquivos, nunca um arquivo inteiro reescrito. Inclua só o que eu aprovei durante a sessão.

1. estado.md
   - Resumo do capítulo em 3 a 5 linhas.
   - Setups novos (pista | plantada em | ideia de pagamento).
   - Setups pagos (pista | plantada em | paga em).
   - Decisões de enredo tomadas.
   - Se o resumo geral mudou, a frase nova a substituir.
2. Fichas
   - Para cada ficha existente que mudou: só as linhas a adicionar ou alterar, com o capítulo de origem.
   - Para entidades novas: a ficha completa no modelo (essencial, fatos, relações, segredos, voz, não pode), em estilo telegráfico.
3. alfabeto.md
   - Nomes novos aprovados: nome | quem ou o quê | povo | capítulo.
4. Pendências e dúvidas para a próxima sessão.

Depois, em seção separada chamada NÃO APROVADO: tudo que você propôs e eu não aprovei explicitamente, para eu decidir se descarto.

Por último, termine a resposta com UM bloco de código com a etiqueta `lore-pack-mudancas`, com as mesmas mudanças em JSON. O lore-pack lê esse bloco, me mostra cada mudança e só grava as que eu escolher. O formato é este:

```lore-pack-mudancas
{
  "operacoes": [
    { "op": "estado_adicionar", "secao": "Capítulos", "linhas": ["cap-03: Ana chega ao farol e encontra a lanterna apagada."] },
    { "op": "estado_adicionar", "secao": "Setups abertos", "linhas": ["- a lanterna apagada | cap-03 | o faroleiro esconde algo"] },
    { "op": "estado_substituir", "antigo": "Ana procura o farol.", "novo": "Ana achou o farol e desconfia do faroleiro." },
    { "op": "ficha_adicionar", "id": "ana-ferreira", "secao": "Fatos", "linhas": ["- Subiu ao farol sozinha (cap-03)."] },
    { "op": "ficha_substituir", "id": "ana-ferreira", "antigo": "status: viva", "novo": "status: ferida" },
    { "op": "ficha_criar", "tipo": "personagem", "id": "tobias-vau", "conteudo": "---\nid: tobias-vau\ntipo: personagem\nnome: Tobias Vau\naliases: [o faroleiro]\nstatus: vivo\naparece_em: [cap-03]\n---\n**Essencial (1 linha):** faroleiro que evita falar da lanterna.\n\n**Fatos** (telegráfico, com capítulo de origem):\n- Cuida do farol há vinte anos (cap-03).\n" },
    { "op": "alfabeto_adicionar", "linhas": ["- Tobias Vau | faroleiro | costeiros | cap-03"] },
    { "op": "nao_aprovado", "itens": ["O farol ser assombrado."] }
  ]
}
```

Regras do bloco:
- Um bloco só, no fim da resposta, com JSON válido: aspas duplas, sem vírgula sobrando, sem comentários. Quebra de linha dentro de um texto se escreve `\n`.
- `estado_adicionar`: acrescenta linhas no fim de uma seção do estado.md. `secao` é o título da seção (o texto depois de `## `, sem o que vem entre parênteses), e precisa existir no arquivo.
- `estado_substituir`: troca um trecho do estado.md, por exemplo a frase do resumo geral. `antigo` precisa ser copiado exatamente como está no arquivo e aparecer nele uma vez só.
- `ficha_adicionar`: acrescenta linhas no fim de uma seção de uma ficha que já existe. `id` é o id da ficha; `secao` é o título em negrito, como `Fatos`, `Relações` ou `Segredos`.
- `ficha_substituir`: troca um trecho de uma ficha que já existe (serve para `status`, `aliases` e `aparece_em`). `antigo` segue a mesma regra do `estado_substituir`.
- `ficha_criar`: cria uma ficha nova. `conteudo` é a ficha inteira no modelo de `modelos/ficha-modelo.md`, com o cabeçalho, e o `id` e o `tipo` do cabeçalho são iguais aos da operação. `tipo` é um de: personagem, lugar, faccao, objeto, povo, conceito. `id` só com letras minúsculas sem acento, números e hífen.
- `alfabeto_adicionar`: acrescenta nomes em "Nomes já usados" do alfabeto.md. Para outra seção, acrescente `"secao": "..."`.
- `nao_aprovado`: os itens da seção NÃO APROVADO. Só informa; nunca é aplicado.
- Em `linhas`, cada item é uma linha só.
- Não existe operação para apagar arquivo nem para mexer na bíblia, nos capítulos ou nas referências. Se uma mudança que eu aprovei não cabe nessas operações, deixe-a só no texto, numa seção chamada PARA APLICAR À MÃO.
- Operação sem nada para mudar não entra no bloco. Se não houver mudança nenhuma, o bloco é `{ "operacoes": [] }`.
