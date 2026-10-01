# Diário de decisões

Cada entrada: data, decisão, motivo e alternativas consideradas.

## 2026-10-01: argumentos da CLI com `util.parseArgs`

Decisão: usar o `util.parseArgs` do próprio Node em vez de uma biblioteca de CLI.

Motivo: a CLI tem poucos comandos e opções simples. O `parseArgs` já vem no Node, então não acrescenta dependência nem manutenção. A ajuda é escrita à mão, em português.

Alternativas: commander e yargs geram a ajuda e tratam subcomandos sozinhos, mas são dependência extra e trazem mensagens em inglês. Reavaliar se os subcomandos ficarem complexos.

## 2026-10-01: `@types/node` como dependência de desenvolvimento

Decisão: instalar `@types/node`, além de TypeScript, Vitest e tsx.

Motivo: o TypeScript strict precisa dos tipos das APIs do Node (`node:fs`, `node:util`). São só tipos e não vão para o pacote publicado.

## 2026-10-01: `yaml` para ler o cabeçalho das fichas

Decisão: usar o pacote `yaml` para interpretar o frontmatter. A separação entre cabeçalho e corpo é feita por uma função nossa (`src/core/frontmatter.ts`).

Motivo: o Node não lê YAML sozinho. O `yaml` não tem dependências, já vem com tipos TypeScript e informa a linha do erro, o que permite mensagens úteis.

Alternativas: `js-yaml` (precisa de `@types` à parte) e `gray-matter` (separa o frontmatter sozinho, mas é mais uma camada que não controlamos e o CLAUDE.md pede função própria).

## 2026-10-01: `zod` para validar a ficha

Decisão: descrever a ficha com um schema Zod (v4) e gerar o tipo `Ficha` a partir dele.

Motivo: uma única definição serve de validação e de tipo TypeScript. As mensagens de erro em português ficam junto da regra (opção `error` do Zod 4), e o Zod diferencia campo ausente de campo vazio.

Alternativas: validar à mão com `if`s (mais código e o tipo fica separado da regra).

## 2026-10-01: ids aceitam números

Decisão: o padrão do id é letras minúsculas sem acento, números e hífen (`guarda-02`), em blocos separados por um hífen só.

Motivo: personagens secundários e objetos numerados são comuns, e os capítulos já seguem esse padrão (`cap-01`). Acento fica proibido porque o id vira nome de arquivo.

## 2026-10-01: o `check` lê só o que valida

Decisão: o `check` lê os `.md` da raiz e os `.md` dentro de `fichas/`. Ignora `capitulos/`, `modelos/` e `prompts-de-sessao/`.

Motivo: capítulos podem ser grandes e não são validados no M1. O modelo de ficha tem valores de exemplo e daria erro se fosse validado como ficha.
