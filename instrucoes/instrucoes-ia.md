# Instruções para a IA nesta pasta

Esta pasta é uma história escrita com o lore-pack. O autor decide o enredo; você é co-autor.
Arquivo gerado pelo lore-pack. Para atualizar: `lore-pack atualizar-instrucoes`.
Regras só desta história ficam em `instrucoes-da-historia.md`; o lore-pack as copia para o fim deste arquivo.

## O que é cada coisa
- `biblia.md`: premissa, tom, leis do mundo, conflito central e as verdades ocultas do autor.
- `estado.md`: onde a história está agora (resumo geral, resumo por capítulo, decisões, setups abertos).
- `alfabeto.md`: línguas e escritas do mundo, regras de nome por povo e lista de nomes já usados.
- `fichas/<pasta>/<id>.md`: uma ficha por personagem, lugar, facção, objeto, povo ou conceito.
- `referencias/<id>.md`: o cânone por tema (magia, combate, política...).
- `capitulos/cap-NN.md`: o texto final, já aprovado, de cada capítulo.
- `sessoes/<id>/`: uma pasta por sessão: `sessao.md` (plano), `pacote.md` (contexto da
  sessão), `rascunho.md` (cenas) e `fechamento.md` (propostas de mudança).
- `prompts-de-sessao/`: os prompts que o autor usa.
- `modelos/`: modelos de ficha e de referência. Ao criar ou propor uma ficha, siga o modelo.

## Formato da ficha
Tipos e pastas: `personagem` → `personagens/`, `lugar` → `lugares/`, `faccao` → `faccoes/`,
`objeto` → `objetos/`, `povo` → `povos/`, `conceito` → `conceitos/`.
O `id` é igual ao nome do arquivo (minúsculas, sem acento, palavras separadas por hífen).

    ---
    id: guilda-dos-sineiros
    tipo: faccao
    nome: Guilda dos Sineiros
    aliases: [a Guilda]
    relacionados: [oto-varga, sino-mudo]
    ---

    # Guilda dos Sineiros

    Resumo em uma ou duas frases: o que é e por que importa.

    ## Detalhes

    - **Campo em negrito:** um fato por linha.

    ## Relações

    [[oto-varga]] · [[sino-mudo]]

    ## Segredo do autor

    > Nunca revelar diretamente no texto.

    O que o leitor ainda não sabe. Seção opcional: omita se não houver segredo.

    ## Na história

    Ainda não apareceu.

Regras do formato:
- Campos obrigatórios: `id`, `tipo`, `nome`, `aliases`, `relacionados` (lista vazia é `[]`).
  Outros campos só se o autor já usa nesta história (veja as fichas que existem).
- `relacionados` lista ids sem colchetes; no corpo, os mesmos ids vão como `[[id]]`. Todo id citado precisa ter ficha ou referência.
- Cada nome ou alias pertence a uma ficha só. Nada de aliases genéricos ("o rei", "criatura").
- Seções sempre nesta ordem: resumo, `## Detalhes`, `## Relações`, `## Segredo do autor` (opcional), `## Na história`.
- `## Na história` registra, por capítulo, o que aconteceu com aquilo ("cap-02: perde o braço na ponte").
  É atualizada pelo fechamento, nunca durante a escrita.

## Formato da referência

    ---
    id: sinos
    tipo: referencia
    nome: Sinos e toques
    palavras_chave: [toque, badalo, liga]
    ---

    # Sinos e toques

    ## 1. Os toques

    ### 1.1 O toque de cheia
    Regras detalhadas, em seções numeradas (§) para poder citar.

Regras do formato:
- Campos obrigatórios: `id`, `tipo: referencia`, `nome`, `palavras_chave`.
- `palavras_chave` são os termos que, quando aparecem no plano da cena, puxam a referência.
- Referências **não** têm seção de segredos. As verdades ocultas ficam na bíblia e na seção
  `## Segredo do autor` das fichas. Onde uma referência toca um segredo, ela só diz "ver a bíblia".

## O que você pode mudar
Você pode editar qualquer arquivo da história. O que muda é quando precisa de um pedido do autor:
- **Sempre livre:** `sessoes/<id>/rascunho.md` (texto das cenas) e `sessoes/<id>/fechamento.md`
  (propostas, no formato de `prompts-de-sessao/04-fechar-sessao.md`).
- **Livre para consertar a forma:** cabeçalho inválido, campo que falta, id diferente do nome do
  arquivo, ficha na pasta errada, seção fora de ordem, link `[[id]]` quebrado, erro de digitação.
  Conserte sem perguntar e avise o que fez.
- **Com pedido do autor:** mudar o conteúdo de `biblia.md`, `estado.md`, `alfabeto.md`, `fichas/`,
  `referencias/` e `capitulos/` (criar ficha, mudar um fato, reescrever um trecho, resolver uma
  contradição). Pedido dado, faça direto no arquivo, sem pedir confirmação de novo.
- **Sem pedido:** fato, nome ou detalhe novo que surgiu na escrita vai como proposta no fechamento.
  Nada vira cânone sem a aprovação do autor.
- **Nunca:** `CLAUDE.md`, `AGENTS.md`, `instrucoes-da-historia.md`, `.claude/settings.json` e
  `lore-pack.config.json`.

## Ao editar um arquivo do cânone
1. Leia o arquivo inteiro antes. Mude só o que foi pedido: não reescreva, não resuma e não apague o resto.
2. Todo fato que você escrever precisa vir do autor ou de um arquivo desta pasta. Se não está em
   nenhum dos dois, pergunte em vez de inventar. Na dúvida entre duas leituras, pergunte.
3. Antes de afirmar algo sobre a história, confira no arquivo. Não confie na memória da conversa.
4. Uma mudança que contradiz outro arquivo: avise o autor e diga quais arquivos, antes de mudar.
5. Mudou um nome ou um id: procure onde mais ele aparece e ajuste junto.
6. Depois de editar, rode `lore-pack check` e corrija o que ele acusar no que você mexeu.
7. Termine dizendo quais arquivos mudaram e o quê, em uma linha por arquivo.

## Ao escrever cenas
1. Comece pelo `pacote.md` da sessão: ele já traz o que importa. Só abra outra ficha, referência
   ou capítulo se precisar, e diga qual abriu.
2. Os segredos (na bíblia e nas seções `## Segredo do autor`) servem para manter a coerência. Nunca
   revele o conteúdo deles no texto da história sem o autor pedir; pode insinuar se ele orientar.
3. Siga o tom que a bíblia define.
4. Nome novo segue `alfabeto.md` (regras do povo e sons da língua) e não repete a lista de nomes já usados.

O lore-pack guarda uma cópia dos arquivos do cânone quando a sessão começa e mostra ao autor o
diff de qualquer mudança neles. Ele pode desfazer tudo com um clique, então errar não é grave;
esconder uma mudança é.
