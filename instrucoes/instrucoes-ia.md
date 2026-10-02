# Instruções para a IA nesta pasta

Esta pasta é uma história escrita com o lore-pack. O autor decide o enredo; você é co-autor.
Arquivo gerado pelo lore-pack. Para atualizar: `lore-pack atualizar-instrucoes`.

## O que é cada coisa
- `biblia.md`: premissa, tom e regras gerais do mundo.
- `estado.md`: onde a história está agora (o que aconteceu, setups abertos).
- `alfabeto.md`: regras para criar nomes.
- `fichas/<tipo>/<id>.md`: uma ficha por personagem, lugar, facção, objeto, povo ou conceito.
- `referencias/<id>.md`: o cânone por tema (magia, combate, política...).
- `capitulos/cap-NN.md`: o texto final, já aprovado, de cada capítulo.
- `sessoes/<id>/`: uma pasta por sessão: `sessao.md` (plano), `pacote.md` (contexto da
  sessão), `rascunho.md` (cenas) e `fechamento.md` (propostas de mudança).
- `prompts-de-sessao/`: os prompts que o autor usa.

## Formato da ficha
Tipos: personagem, lugar, faccao, objeto, povo, conceito. Pasta de cada um: personagens,
lugares, faccoes, objetos, povos, conceitos. O `id` é igual ao nome do arquivo.

    ---
    id: ana-ferreira
    tipo: personagem
    nome: Ana Ferreira
    aliases: [Aninha]
    status: viva
    aparece_em: [cap-01]
    ---
    **Essencial:** cartógrafa que foge da capital.
    **Segredos (o leitor ainda não sabe):**
    - É filha do capitão.

## Formato da referência

    ---
    id: magia
    nome: Magia
    palavras_chave: [Resto, feitiço]
    ---
    **Regras:**
    - Todo feitiço deixa um Resto.
    **Segredos (o leitor ainda não sabe):**
    - O Resto é a memória dos mortos.

## Regras
1. Nunca edite diretamente `biblia.md`, `estado.md`, `alfabeto.md`, nem nada em `fichas/`,
   `referencias/` ou `capitulos/`.
2. Você só escreve em `sessoes/<id>/rascunho.md` (texto das cenas) e em
   `sessoes/<id>/fechamento.md` (propostas, no formato de `prompts-de-sessao/04-fechar-sessao.md`).
3. Nada vira cânone sem a aprovação do autor. Nome, fato ou detalhe novo vai como proposta
   no fechamento.
4. As seções de Segredos das fichas e das referências servem para manter a coerência. Nunca
   revele o conteúdo delas no texto da história sem o autor pedir; pode insinuar se ele orientar.
5. Se algo não está nos arquivos, pergunte em vez de inventar.
6. Comece pelo `pacote.md` da sessão: ele já traz o que importa. Só abra outra ficha,
   referência ou capítulo se precisar, e diga qual abriu.

O lore-pack guarda uma cópia dos arquivos protegidos quando a sessão começa e acusa
qualquer mudança neles.
