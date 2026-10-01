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

## 2026-10-01: como o `pack` monta a mensagem

Decisões:
- Do modelo `00-abrir-sessao.md`, o pack usa só o texto depois da linha `## Copie a partir daqui` (o que vem antes é instrução para o autor, não para a IA). Sem essa linha, usa o arquivo inteiro.
- Um bloco é um título `=== ... ===` mais o texto até o próximo título. Se algum marcador do bloco estiver vazio, o bloco inteiro sai, título junto.
- O 00 da pasta do usuário é usado se tiver pelo menos um marcador conhecido; senão, o pack usa o modelo que vem com o lore-pack e avisa. Marcador desconhecido (`{{fixas}}`) fica no texto, para o erro de digitação aparecer.
- As fichas entram inteiras (com o cabeçalho), em ordem alfabética do caminho do arquivo. O cabeçalho tem nome, aliases e status, que ajudam a IA.

Motivo: o pacote precisa sair pronto para colar, sem sobras, e o usuário pode personalizar o modelo sem mexer em código.

## 2026-10-01: estimativa de tokens = caracteres ÷ 3

Decisão: estimar 1 token a cada 3 caracteres, arredondando para cima, e sempre dizer "aproximado" na saída.

Motivo: contar de verdade exigiria o tokenizador de cada IA (dependência nova e diferente por fornecedor). Em inglês a média fica perto de 4 caracteres por token; em português, menos. O fator 3 erra para cima de propósito: é melhor sobrar espaço do que estourar.

## 2026-10-01: detalhes do `pack`

- **Última cena:** o capítulo mais recente é o último pela ordem do nome do arquivo, com comparação numérica (`cap-10` vem depois de `cap-2`, mesmo sem zero à esquerda).
- **`--sem-ultima-cena`** também deixa de usar a cena para achar fichas: se a cena não vai no pacote, as fichas citadas só nela não têm por que ir.
- **`--com` e `--sem`** aceitam vírgula e também podem ser repetidos (`--com a,b --com c`).
- **`--cena` e `--saida`** são relativos à pasta onde o comando é rodado, como em qualquer programa de terminal. Só o padrão de `--saida` (`pacote.md`) fica na pasta da história.
- **Marca de arquivo gerado:** a primeira linha é um comentário `<!-- lore-pack: ... -->`. A checagem olha só o começo (`<!-- lore-pack:`), para pacotes antigos continuarem sobrescrevíveis se o texto da marca mudar.
- **Quebras de linha:** a CLI lê todo arquivo trocando `\r\n` por `\n` e tirando o BOM, para o pacote sair igual no Windows e no Linux.
- **O `pack` tem parse próprio de argumentos:** o `main` repassa tudo depois de `pack` para ele, porque só o pack conhece `--cena`, `--com` etc.
