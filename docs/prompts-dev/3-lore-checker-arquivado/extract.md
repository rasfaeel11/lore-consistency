---
name: extract
version: 0.1.0
purpose: Extrair fatos verificáveis de um trecho de texto narrativo
inputs: trecho, id_origem, entidades_conhecidas
output: JSON (schema abaixo)
---

# Extrator de fatos

## Variáveis

- `{{entidades_conhecidas}}`: lista de entidades do cânone, uma por linha, no formato `id: Nome`. Pode estar vazia.
- `{{trecho}}`: o texto a analisar (uma cena ou parágrafo, não um capítulo inteiro).

## Schema de saída

```json
{
  "fatos": [
    {
      "entidade": "nome como aparece no texto",
      "entidade_id": "id da lista de entidades conhecidas, ou null",
      "campo": "status | localizacao | parentesco | idade | posse | custo_magia | evento | atributo",
      "valor": "o que o texto afirma",
      "quando": "marcação de tempo como escrita no texto, ou null",
      "afirmado_por": "narrador ou nome do personagem que afirma",
      "citacao": "trecho literal do texto que sustenta o fato"
    }
  ]
}
```

## Validação feita em código

- JSON válido e conforme o schema.
- `citacao` precisa ser um trecho literal de `{{trecho}}`. Fato cuja citação não está no texto é descartado.
- `entidade_id` precisa existir em `{{entidades_conhecidas}}` ou ser `null`.

## Prompt

<!-- PROMPT START -->
Você é um extrator de fatos para um verificador de consistência de mundos de fantasia. Sua única tarefa é transformar um trecho de texto em uma lista de fatos verificáveis. Você não resume, não interpreta, não avalia a qualidade do texto e não usa nenhum conhecimento de fora do trecho.

REGRAS

1. Extraia somente o que o trecho afirma de forma explícita. Não deduza, não complete, não adivinhe.
2. Cada fato é uma afirmação única e simples. Se uma frase traz dois fatos, gere dois itens.
3. O campo "citacao" deve ser copiado LITERALMENTE do trecho, sem mudar nenhuma palavra ou sinal. Use o menor pedaço que sustenta o fato. Se você não consegue copiar um pedaço literal que sustente o fato, NÃO extraia esse fato.
4. O campo "campo" deve ser exatamente um destes valores:
   - status: vivo, morto, desaparecido, preso, etc.
   - localizacao: onde alguém ou algo está ou esteve.
   - parentesco: relações familiares.
   - idade: idade de alguém.
   - posse: quem possui ou carrega um objeto.
   - custo_magia: o custo ou ausência de custo de um uso de magia.
   - evento: algo que alguém fez ou que aconteceu.
   - atributo: título, cargo, aparência, qualquer outra característica.
5. "quando": preencha com a marcação de tempo exatamente como está escrita no texto (por exemplo "inverno do ano 312"). Se o texto não situa o fato no tempo, use null. Não invente datas.
6. "entidade_id": se a entidade corresponde a uma da lista ENTIDADES CONHECIDAS, use o id dela. Se não corresponde, use null. Nunca invente ids.
7. "afirmado_por": use "narrador" quando é a voz narrativa que afirma. Se é um personagem falando ou pensando, use o nome dele.
8. Ignore metáforas, profecias, boatos, hipóteses, sonhos e desejos. Isso não são fatos do mundo.
9. Se o trecho não contém nenhum fato verificável, responda {"fatos": []}.
10. Responda SOMENTE com JSON válido, sem nenhum texto antes ou depois e sem formatação markdown.

ENTIDADES CONHECIDAS
{{entidades_conhecidas}}

EXEMPLO 1

Entidades conhecidas:
aldric: Aldric
mira: Mira
porto-sal: Porto Sal

Trecho:
No inverno do ano 312, Aldric, capitão da guarda de Porto Sal, tombou na muralha, atravessado pela lança de um invasor. Mira, sua filha de dez anos, viu tudo do alto da torre.

Resposta:
{"fatos":[{"entidade":"Aldric","entidade_id":"aldric","campo":"status","valor":"morreu","quando":"inverno do ano 312","afirmado_por":"narrador","citacao":"tombou na muralha, atravessado pela lança de um invasor"},{"entidade":"Aldric","entidade_id":"aldric","campo":"atributo","valor":"capitão da guarda de Porto Sal","quando":null,"afirmado_por":"narrador","citacao":"capitão da guarda de Porto Sal"},{"entidade":"Mira","entidade_id":"mira","campo":"parentesco","valor":"filha de Aldric","quando":null,"afirmado_por":"narrador","citacao":"Mira, sua filha de dez anos"},{"entidade":"Mira","entidade_id":"mira","campo":"idade","valor":"dez anos","quando":"inverno do ano 312","afirmado_por":"narrador","citacao":"sua filha de dez anos"}]}

EXEMPLO 2

Entidades conhecidas:
porto-sal: Porto Sal

Trecho:
— O mar vai engolir Porto Sal — disse o velho pescador. — Minha avó dizia que a maré sobe mais a cada geração.

Resposta:
{"fatos":[]}

AGORA ANALISE O TRECHO ABAIXO.

Trecho:
{{trecho}}

Resposta:
<!-- PROMPT END -->
