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

Decisão: o `check` lê os `.md` da raiz e os `.md` dentro de `fichas/`. Ignora `capitulos/`, `modelos/` e `prompts-de-sessao/`. (Atualizado no M3: passa a ler também `capitulos/*.md` e `sessoes/<id>/sessao.md`.)

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

## 2026-10-01: formato de capítulos e sessões (M3)

- **Capítulos:** `capitulos/cap-NN.md`, com dois dígitos e mais quando passar de 99 (`cap-100`). Nome fora desse padrão é erro no `check`, porque a sessão aponta para o capítulo pelo nome do arquivo. O título é o primeiro cabeçalho `# `; sem ele, vale o nome do arquivo.
- **Sessões:** uma pasta por sessão, `sessoes/<id>/`, com `sessao.md` (cabeçalho YAML + plano + resumo), `pacote.md` e, depois de fechada, `fechamento.md`. O `id` precisa ser igual ao nome da pasta, como nas fichas, e o `capitulo` precisa existir em `capitulos/`.
- **Id da sessão:** `data-capítulo-sequência` (`2026-10-01-cap-03-02`). A sequência conta as sessões do capítulo em todos os dias, então `-02` quer dizer "2ª sessão do capítulo". A data é a local, não a UTC: às 22h no Brasil a UTC já está no dia seguinte. `criada_em` e `fechada_em` ficam em ISO UTC (`toISOString()`).
- **Para não colidir**, o próximo id conta todas as pastas de `sessoes/`, mesmo as que têm `sessao.md` inválido.
- **Última cena:** vem do capítulo da sessão. Se ele só tiver o título (capítulo recém-criado), vem do anterior. O `pack` usa a mesma regra a partir do capítulo mais recente, então o `capitulo novo` não deixa o pacote sem cena.
- **`sessao fechar` reescreve o cabeçalho do `sessao.md`** (status e `fechada_em`) e mantém o corpo e campos extras. Rodar o comando conta como a confirmação do princípio 4. O resumo vem de `--resumo "texto"` e vira a seção `## Resumo`. O `fechamento.md` nunca é sobrescrito.
- **O cabeçalho é gerado com o `stringify` do pacote `yaml`**, que já é dependência. O YAML 1.2 não transforma datas em objeto, então `criada_em` volta como texto.
- **Se o pack falhar no `sessao nova`**, a pasta recém-criada da sessão é apagada, para não sobrar sessão sem pacote.
- **`sessao nova` não executa nada:** só imprime o comando sugerido (`claude "Leia o arquivo ... e siga as instruções dele."`) e a alternativa de colar o pacote em outra IA.

## 2026-10-01: app local (M4a)

- **Servidor com `node:http`, sem framework.** São quatro rotas JSON e três arquivos estáticos; Express ou Fastify seriam dependência sem ganho. O código fica em `src/server/`, uma borda nova ao lado de `src/cli/`, e reaproveita as funções de leitura e escrita da CLI.
- **Comando `lore-pack app [pasta] [--porta N]`**, porta padrão 4777. É o único comando assíncrono (deixa o servidor rodando até o Ctrl+C), por isso o `index.ts` o chama à parte do `main`. Não abre o navegador sozinho: imprime o endereço.
- **Só 127.0.0.1 (princípio 8), e mais três proteções**, porque qualquer site aberto no navegador consegue mandar pedidos para `127.0.0.1`:
  - o cabeçalho `Host` precisa ser `127.0.0.1:<porta>` ou `localhost:<porta>` (bloqueia "DNS rebinding");
  - se vier `Origin`, ela precisa ser o próprio app;
  - o `POST` só aceita `Content-Type: application/json`, que um formulário de outro site não consegue mandar sem permissão do servidor (CORS), e o servidor nunca dá essa permissão.
- **Arquivos estáticos numa lista fechada** (`/`, `/app.js`, `/style.css`): nenhum caminho vindo do navegador vira caminho no disco. Ids de sessão passam pelo mesmo padrão do `sessao.md` antes de montar o caminho.
- **Página em HTML, CSS e JavaScript puro, em `web/`**, sem bundler e sem TypeScript no navegador. Compilar TS para o navegador pediria uma segunda configuração de build ou um bundler; para uma página pequena não compensa. Reavaliar no M4b se o xterm.js deixar o código do navegador maior. Todo texto da história entra com `textContent`, nunca como HTML.
- **`createSession` saiu do `sessao nova`** para o app usar a mesma lógica. O `writePack` passou a receber o texto do plano (`plan`) em vez do caminho, porque no app o plano vem do formulário. A CLI lê o arquivo e passa o texto.
- **O botão "Copiar pacote"** usa a área de transferência do navegador (princípio 9: sempre dá para só copiar). O `--copiar` da CLI continua no V2.

## 2026-10-01: referências e tipos novos (M4a.1)

- **Referências em `referencias/<id>.md`**, cabeçalho com `id`, `nome` e `palavras_chave`. O schema reaproveita os campos `id` e `nome` da ficha (`idField`, `nomeField`), para as mensagens de erro serem as mesmas.
- **`palavras_chave` é opcional.** Sem ela, a referência só entra com `--ref`. Isso serve para cânone que você quer mandar só de vez em quando.
- **O id é único entre fichas e referências**, porque o `--sem` vale para as duas e precisa saber o que tirar.
- **Só o plano e o `--ref` puxam referências**, nunca a última cena. A cena anterior quase sempre cita algum termo do cânone; se ela puxasse referências, cada sessão herdaria as da anterior e o pacote cresceria sozinho.
- **A busca é a mesma do `findMentions`** (palavra inteira, sem diferenciar maiúsculas e acentos). Para isso o `findMentions` virou um caso de uma função mais geral, `findTerms`, que recebe qualquer lista de termos. As referências são buscadas separadas das fichas: um termo de ficha não "esconde" uma palavra-chave mais curta de referência.
- **Palavra-chave genérica:** aviso quando ela aparece (mesma busca) em mais da metade das *outras* fichas e referências, olhando o arquivo inteiro. A referência dona da palavra fica fora da conta, senão ela sempre contaria a si mesma. Exatamente metade não avisa.
- **Pacote:** bloco `{{referencias}}` depois das fichas. Se o `00` do usuário for de uma versão antiga e não tiver esse marcador, as referências escolhidas ficam de fora e o resumo avisa como consertar, em vez de acrescentar o bloco sozinho (princípio 4).
- **Resumo:** cada referência com motivo, palavras que casaram e tokens. A linha "Referências no pacote" só aparece se a pasta tiver alguma referência, para não poluir histórias que não usam. O `check` só conta referências quando elas existem, pelo mesmo motivo.
- **`formatReport` recebe os arquivos** em vez do número de fichas, porque agora conta fichas e referências. Os três lugares que o chamam repetiam a contagem.
- **App:** o formulário mostra uma caixa por referência (escondido se não houver nenhuma). As marcadas viram `--ref`; as que têm palavra-chave no plano entram sozinhas, igual na CLI.
- **Tipos `povo` e `conceito`**, nas pastas `fichas/povos/` e `fichas/conceitos/`. "Conceito" cobre fenômenos, entidades cósmicas e eventos históricos: o que tem nome e aparece na cena, mas não é personagem, lugar, facção nem objeto.
