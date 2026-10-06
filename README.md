# lore-pack

[English](README.en.md) · Português

Ferramenta de linha de comando (com um app local opcional) para quem escreve histórias com ajuda de IA. Ela organiza o mundo da história em fichas de markdown e monta, para cada sessão de escrita, o **pacote de contexto**: só o que a IA precisa saber para escrever a próxima cena.

Funciona com qualquer IA (Claude, Gemini, ChatGPT): a ferramenta gera o texto e você cola. Sem API, sem conta, sem pagamento. Os arquivos da sua história nunca saem do seu computador.

<!-- GIF de demonstração entra aqui: docs/demo.gif (como gravar: veja "Como gravar o GIF", no fim) -->

## O problema

Uma história longa não cabe numa conversa com a IA. Depois de alguns capítulos, ou você cola tudo de novo a cada sessão (caro, lento, e a IA se perde), ou cola pouco e ela esquece a cor dos olhos de alguém, ressuscita quem morreu e inventa um nome que já existe.

O que funciona é disciplina: uma bíblia curta, um resumo do estado da história, uma ficha por personagem e por lugar, e em cada sessão levar só as fichas da cena. Fazer isso à mão cansa. O lore-pack faz a parte mecânica.

## O que ele faz

- **`init`** cria a pasta da história com os modelos: bíblia, estado, alfabeto de nomes, fichas, referências e os prompts de cada etapa da sessão.
- **`check`** valida as fichas: campos obrigatórios, ids repetidos, nome usado em duas fichas, ficha na pasta errada.
- **`pack`** monta o pacote da sessão: bíblia + estado + só as fichas citadas no plano da cena e na última cena + as referências do tema + a última cena, com estimativa de tokens.
- **`capitulo`** e **`sessao`** organizam capítulos e sessões de escrita, cada sessão na sua pasta.
- **`apply`** lê as mudanças que a IA propôs no fim da sessão, mostra o diff de cada uma e grava só as que você escolher.
- **`ui`** abre um app no navegador, só no seu computador, com tudo isso em botões e um terminal embutido para a IA.
- **Guarda do cânone:** quando a sessão começa, o lore-pack guarda uma cópia dos arquivos da história e depois acusa qualquer mudança feita por fora da sua aprovação.

## Instalação

Precisa do [Node.js](https://nodejs.org) 24 ou mais novo.

```
npm install -g lore-pack
lore-pack --help
```

Para rodar a partir do código:

```
git clone https://github.com/rasfaeel11/lore-consistency.git
cd lore-consistency
npm install
npm run relink
```

O terminal embutido do app usa o pacote opcional `node-pty`, que traz binário pronto para Windows e macOS. No Linux ele precisa compilar (Python, make e um compilador C++); se não compilar, a instalação termina do mesmo jeito, o terminal aparece desligado e todo o resto funciona.

## Tutorial de 5 minutos

**1. Crie a pasta da história.**

```
lore-pack init minha-historia
cd minha-historia
```

Abra o `biblia.md` e escreva a premissa e as regras do mundo. O `COMO-USAR.md` da pasta explica cada arquivo.

**2. Crie a primeira ficha.** Copie `modelos/ficha-modelo.md` para `fichas/personagens/ana-ferreira.md` e preencha o cabeçalho:

```yaml
---
id: ana-ferreira
tipo: personagem
nome: Ana Ferreira
aliases: [Aninha]
status: viva
aparece_em: []
---
```

Depois confira:

```
lore-pack check
```

**3. Crie o capítulo e a sessão.** Escreva em `plano.md` o que acontece na próxima cena, citando personagens e lugares pelo nome ("Ana Ferreira chega ao porto...").

```
lore-pack capitulo novo "A chegada"
lore-pack sessao nova --capitulo cap-01 --plano plano.md
```

O lore-pack diz quais fichas entraram no pacote e por quê, e quantos tokens ele tem. O pacote fica em `sessoes/<id>/pacote.md`.

**4. Escreva com a IA.** Cole o `pacote.md` numa conversa nova, em qualquer IA. Com o Claude Code, o comando que o `sessao nova` imprime já abre a IA lendo o pacote.

**5. Feche a sessão.** Cole na IA o prompt `prompts-de-sessao/04-fechar-sessao.md` e salve a resposta em `sessoes/<id>/fechamento.md`. Depois:

```
lore-pack apply <id>                  # mostra cada mudança proposta, com o diff
lore-pack apply <id> --aplicar 1,3    # grava só as que você escolheu
lore-pack sessao fechar <id>
```

Prefere janela a terminal? Rode `lore-pack ui` na pasta da história.

**Quer ver uma pasta já preenchida?** O repositório traz [`exemplos/varmonte`](exemplos/varmonte): um mundo inventado pequeno, com seis fichas, uma referência, dois capítulos e uma sessão fechada, feito com os comandos acima. Com o repositório clonado:

```
lore-pack check exemplos/varmonte
lore-pack sessao listar exemplos/varmonte
lore-pack ui exemplos/varmonte
```

O exemplo não vai no pacote do npm, e não traz o `CLAUDE.md`, o `AGENTS.md` nem o `.claude/settings.json` que o `init` cria na sua pasta.

## O fluxo de uma sessão

```
sessao nova ──► pacote.md ──► você e a IA escrevem ──► prompt 04 ──► fechamento.md
     │                                                                    │
     └─ snapshot dos arquivos (guarda)            apply: você escolhe ◄───┘
                                                         │
                              estado.md, alfabeto.md e fichas atualizados
                                                         │
                                                   sessao fechar
```

1. `sessao nova` cria `sessoes/<id>/` com o plano (`sessao.md`) e o pacote (`pacote.md`), e tira um snapshot dos arquivos protegidos.
2. A IA escreve as cenas em `sessoes/<id>/rascunho.md`. Você corrige e aprova.
3. No fim, o prompt 04 pede à IA as mudanças nos arquivos. A resposta termina com um bloco `lore-pack-mudancas`, uma lista de operações em JSON (`estado_adicionar`, `estado_substituir`, `ficha_criar`, `ficha_adicionar`, `ficha_substituir`, `alfabeto_adicionar`).
4. `apply` mostra cada operação com o diff. Nada é gravado sem `--aplicar`. O que foi aplicado fica anotado em `aplicado.json`, então rodar de novo não repete nada.
5. `sessao fechar` marca a sessão como fechada. Ele recusa se algum arquivo protegido tiver mudado por fora.

## Como funciona

```
                 ┌────────────────────────────────────────────┐
                 │ src/core/  (funções puras)                 │
                 │ fichas, validação, menções, pacote,        │
                 │ sessões, guarda, mudanças do fechamento    │
                 └───────▲───────────────────────▲────────────┘
                         │                       │
        ┌────────────────┴───────┐   ┌───────────┴─────────────────────┐
        │ src/cli/               │   │ src/server/                     │
        │ lê e grava arquivos    │◄──│ node:http + ws, só 127.0.0.1    │
        │ commands.ts: a lista   │   │ terminal embutido (node-pty)    │
        │ única de comandos      │   └───────────▲─────────────────────┘
        └────────────▲───────────┘               │
                     │                  ┌────────┴──────────┐
              lore-pack <comando>       │ web/  (a página)  │
                                        │ HTML, CSS, JS puro│
                                        └───────────────────┘
```

- **`src/core/`** só tem funções que recebem dados e devolvem dados. Não lê disco, não imprime, não acessa rede. É o que os testes exercitam mais de perto.
- **`src/cli/`** é a borda: lê arquivos, chama o núcleo e imprime. Todo comando está numa lista só (`commands.ts`), de onde saem o `--help` e o despacho.
- **`src/server/`** é a outra borda: o servidor do app, que reaproveita o núcleo e as funções da CLI. A página em `web/` é HTML, CSS e JavaScript puro, sem etapa de build.
- **Terminal embutido:** o app abre a IA de linha de comando que você configurar em `lore-pack.config.json` (o padrão é `claude`), dentro da página, na pasta da história. Com `"comando": "nenhum"`, sobra o botão de copiar o pacote.

O formato das fichas e das referências está descrito no [`CLAUDE.md`](CLAUDE.md), e as decisões do projeto, com os motivos, em [`docs/DECISOES.md`](docs/DECISOES.md).

## Segurança

O app roda um servidor no seu computador e pode abrir um programa de terminal. O que ele faz para isso não virar uma porta aberta:

- Escuta só em `127.0.0.1`. Nunca é exposto na rede.
- Cada execução do `lore-pack ui` gera um token novo. A API exige o token no cabeçalho `X-Lore-Pack-Token`; a página e o WebSocket, na URL. Sem o token, nada responde.
- Confere `Host` e `Origin` em todo pedido, para um site aberto no navegador não conseguir falar com o app. Os `POST` exigem `Content-Type: application/json`.
- Serve uma lista fechada de arquivos: nenhum caminho vindo do navegador vira caminho no disco.
- O WebSocket do terminal exige `Origin` do próprio app e o token, aceita mensagens de até 64 KB, e há no máximo 4 terminais abertos.
- O comando do terminal vem só de `lore-pack.config.json`. O navegador diz apenas "abrir terminal para a sessão X".
- No `apply`, o navegador diz só qual sessão e quais números da lista. As operações são lidas, no servidor, do `fechamento.md`, e o caminho de cada arquivo é calculado: nunca vem do JSON da IA.

**A guarda do cânone é detecção depois do fato, não bloqueio.** Se a IA reescrever uma ficha, você descobre e pode reverter, mas a escrita já aconteceu. O `.claude/settings.json` que o `init` cria proíbe o Claude Code de editar os arquivos protegidos, mas vale só para o Claude Code e não pega um script que a IA rode por conta própria. Gemini e ChatGPT ignoram esse arquivo. Use git na pasta da história.

## Limitações

- A contagem de tokens é estimada: caracteres ÷ 3. Cada IA conta de um jeito.
- A busca de menções é por palavra inteira, sem diferenciar maiúsculas e acentos. Ela acha "Ana" no plano; não entende "a cartógrafa".
- O `apply` só altera `estado.md`, `alfabeto.md` e fichas. Não mexe na bíblia, nos capítulos nem nas referências, e não apaga nada.
- O terminal embutido depende do `node-pty`. Sem binário pronto no Linux, ele fica desligado, e "copiar pacote" continua funcionando.
- As mensagens da ferramenta e os modelos estão em português.
- Testado no Windows, e pela CI no Ubuntu e no macOS.

## Roadmap

A versão atual é a 0.1.0. As ideias adiadas estão em [`docs/V2.md`](docs/V2.md). As mais prováveis:

- ordenar as fichas do pacote por relevância;
- checar nomes novos contra o `alfabeto.md`;
- criar capítulo pelo app;
- atualizar os prompts de sessão de uma pasta já criada;
- terminal no Linux sem precisar compilar.

Fora do escopo, de propósito: chamar API de IA, contas de usuário, hospedagem online, sincronização na nuvem e editor de texto próprio.

## Desenvolvimento

```
npm install
npm run typecheck
npm test
npm run build && npm run verify:dist
```

TypeScript `strict`, Vitest, e poucas dependências: `yaml`, `zod`, `ws` e o xterm (mais o `node-pty`, opcional). O histórico das versões está no [`CHANGELOG.md`](CHANGELOG.md).

### Como gravar o GIF

No Windows, o [ScreenToGif](https://www.screentogif.com) resolve. Copie `exemplos/varmonte` para fora do repositório (gravar cria uma sessão e mexe nas fichas) e grave, na janela do navegador com o `lore-pack ui` nessa cópia: criar uma sessão, abrir o terminal, colar um fechamento na seção "Fechamento", desmarcar metade das mudanças e aplicar. Salve como `docs/demo.gif`, com menos de 10 MB, e troque o comentário no topo deste arquivo por `![Demonstração](docs/demo.gif)`.

## Licença

[MIT](LICENSE).
