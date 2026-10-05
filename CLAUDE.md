# lore-pack

> Nome provisório. Antes de publicar, confirmar se o nome está livre no npm.

Ferramenta para quem escreve histórias com ajuda de IA. Organiza o mundo da história em fichas (markdown) e monta o **pacote de contexto** de cada sessão de escrita: bíblia + estado + só as fichas relevantes + última cena, com estimativa de tokens. Funciona com qualquer IA (Claude, Gemini, ChatGPT): a ferramenta gera o texto e o usuário cola. Sem API, sem conta, sem pagamento.

## Status atual

- Marco em andamento: **M5** (`apply`: aprovação do fechamento)
- Atualize esta linha ao fechar cada marco.

## Roteiro

| Marco | Entrega |
|---|---|
| M0 | Esqueleto |
| M1 | `init` e `check` |
| M2 | `pack` |
| M3 | Sessões e capítulos |
| M4a | App local: servidor, barra lateral, nova sessão |
| M4a.1 | Referências por tema, tipos `povo` e `conceito`, regra de segredos no prompt |
| M4b | Terminal embutido |
| M5 | `apply` (aprovação do fechamento) |
| M6 | Publicação |

Fora do escopo até a v1: chamar API de IA, contas de usuário, hospedagem online e servidor acessível fora do próprio computador, sincronização na nuvem, editor de texto próprio. Ideia nova vai para `docs/V2.md`.

## Princípios

1. **O núcleo é puro.** `src/core/` só tem funções que recebem dados e devolvem dados: nada de ler disco, imprimir no terminal ou acessar rede. Isso permite reusar o mesmo núcleo na CLI e, depois, na web.
2. **Entrada e saída ficam nas bordas.** `src/cli/` lê arquivos, chama o núcleo e imprime. A futura interface web será outra borda.
3. **Nada pago, nada na nuvem.** Os arquivos do usuário nunca saem do computador dele.
4. **Nunca alterar arquivo do usuário sem confirmação.** `init` recusa pasta que não esteja vazia. Comandos futuros que escrevem mostram o diff antes.
5. **Mensagens de erro úteis.** Sempre: qual arquivo, qual campo, o que está errado e como consertar. Nada de stack trace para o usuário.
6. **Poucas dependências.** Cada dependência nova precisa de motivo registrado em `docs/DECISOES.md`.
7. **Nenhuma história real no repositório.** Só templates e exemplos inventados. O autor usa a ferramenta na própria história em outra pasta, privada.
8. **O app é local.** O servidor só escuta em 127.0.0.1 e nunca é exposto na rede.
9. **Nada amarrado a uma IA.** O comando que o terminal abre é configurável, e sempre existe a opção de só copiar o pacote.

## Arquitetura

```
src/
  core/        # funções puras: schemas da ficha e da sessão, validação, montagem do pacote, capítulos, sessões, guarda do cânone e configuração do terminal (terminal-config.ts)
  cli/         # comandos (lista única em commands.ts): init, check, pack, capitulo, sessao, atualizar-instrucoes, ui. Lê e escreve arquivos. Também: guard.ts (snapshot da guarda), instrucoes.ts (CLAUDE.md/AGENTS.md da história) e open-browser.ts.
  server/      # servidor do app local (app.ts: node:http + ws, só 127.0.0.1) e terminal embutido (terminal.ts: terminais e WebSocket, node-pty opcional; command.ts: acha o comando no PATH). Usa o núcleo e as funções da CLI.
  index.ts     # ponto de entrada da CLI
web/           # página do app: HTML, CSS e JS puro, servidos pelo server/
templates/     # o que o `init` copia para a pasta da história (inclui o lore-pack.config.json)
instrucoes/    # texto do CLAUDE.md/AGENTS.md e o .claude/settings.json que o `init` grava na história
scripts/       # scripts do build: limpar o dist/ e conferir o build (verify:dist)
tests/
  fixtures/    # pastas de história de teste (válidas e inválidas)
docs/
  DECISOES.md  # diário de decisões
  V2.md        # ideias adiadas
  CHECKLIST-M4b.md # teste manual do terminal e da guarda com o Claude Code de verdade
  prompts-dev/ # prompts que não são do produto. O LEIAME.md é o índice.
    1-lore-pack/dev/               # prompts de marco, para construir o projeto com o Claude Code
    1-lore-pack/sessao-de-escrita/ # versão original dos modelos de prompt de sessão
    2-fluxo-manual-original/       # o fluxo manual de antes do lore-pack (referência)
    3-lore-checker-arquivado/      # projeto anterior, arquivado
.github/workflows/ci.yml # CI: typecheck, testes, build e verify:dist
```

## Formato da ficha

Markdown com cabeçalho YAML, em `fichas/<tipo>/<id>.md`. Modelo em `templates/modelos/ficha-modelo.md`.

- `id`: obrigatório, minúsculas sem acento, números e hífen, igual ao nome do arquivo sem `.md`, único na pasta inteira.
- `tipo`: obrigatório, um de `personagem`, `lugar`, `faccao`, `objeto`, `povo`, `conceito`. Pasta de cada um: `personagens`, `lugares`, `faccoes`, `objetos`, `povos`, `conceitos`.
- `nome`: obrigatório, não vazio.
- `aliases`: opcional, lista de textos (outros nomes, apelidos, títulos). Usado no M2 para achar a ficha numa cena.
- `status`: opcional, texto.
- `aparece_em`: opcional, lista de textos.
- O corpo é livre (markdown).

## Formato da referência

Cânone organizado por tema (magia, combate, política...), em `referencias/<id>.md`. Markdown com cabeçalho YAML. Modelo em `templates/modelos/referencia-modelo.md`.

- `id`: obrigatório, mesma regra das fichas. Único entre fichas e referências (o `--sem` vale para as duas).
- `nome`: obrigatório, não vazio.
- `palavras_chave`: opcional, lista de textos. O `check` avisa quando uma palavra-chave aparece em mais da metade das outras fichas e referências.
- O corpo é livre e pode ser longo.
- O `pack` inclui a referência quando uma palavra-chave aparece no plano da cena (mesma busca do `findMentions`) ou com `--ref id1,id2`. `--sem` também tira referências. A última cena **não** puxa referências. Entram no bloco `{{referencias}}`, depois das fichas.

## Capítulos e sessões

- Capítulo: `capitulos/cap-NN.md`. Título = primeiro cabeçalho `# `; sem ele, o nome do arquivo.
- Sessão: pasta `sessoes/<id>/` com `sessao.md` e `pacote.md`. Id `data-capítulo-sequência` (`2026-10-01-cap-03-01`), igual ao nome da pasta.
- `sessoes/<id>/fechamento.md`: as propostas de mudança. A IA escreve esse arquivo com a sessão ainda **aberta** (é o que o `buildStartPrompt` e o bloco de arquivos do pacote pedem). O `sessao fechar --fechamento <arquivo>` só copia um arquivo para lá, e recusa se ele já existir.
- `sessoes/<id>/alteracoes-diretas.md`: gerado pelo "Manter" da guarda (`sessao verificar --manter` ou o botão do app), com as alterações diretas em arquivos protegidos que o autor decidiu manter.
- Guarda do cânone: ao criar a sessão, o lore-pack copia os arquivos protegidos (`biblia.md`, `estado.md`, `alfabeto.md`, `fichas/`, `referencias/`, `capitulos/`, mais `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` e `lore-pack.config.json`) para `.lore-pack/snapshots/<id>/`, pasta fora do git e ignorada pelo `check`. `sessao verificar` e o app comparam com o snapshot; `sessao fechar` recusa enquanto houver mudança não resolvida. É detecção depois do fato, não bloqueio.
- Cabeçalho do `sessao.md`: `id`, `capitulo` (precisa existir em `capitulos/`), `criada_em` (ISO), `status` (`aberta` | `fechada`), `fechada_em` (obrigatório se fechada). Corpo: `## Plano` e, depois de fechada, `## Resumo` opcional.

## Stack e convenções

- TypeScript `strict`, Node na versão LTS atual, npm.
- Testes: Vitest. Rodar scripts em desenvolvimento: tsx.
- Argumentos da CLI: `util.parseArgs` do próprio Node (sem biblioteca extra).
- YAML: o pacote `yaml`. Separar o frontmatter do corpo com uma função própria e testada.
- Validação: Zod.
- Mensagens da CLI em português. Identificadores de código em inglês. Comentários e documentação em português.
- Todo comando novo vem com testes usando pastas em `tests/fixtures/`.

## Como trabalhar comigo

Estou reaprendendo TypeScript depois de um tempo parado e quero aprender enquanto o projeto anda.

- **Padrão: implemente em passos pequenos e explique o porquê em linguagem simples.** Termine cada tarefa com "Pra estudar": 2 ou 3 pontos que eu deveria entender.
- **Se eu disser "modo guiado":** não entregue pronto. Explique o caminho, me peça para escrever e revise o que eu fizer.
- **Testes primeiro:** escreva o teste, rode para ver falhar, depois implemente.
- **Código simples e idiomático.** Sem generics complicados nem abstração antecipada.
- **Plano curto antes de mudança grande,** e espere eu concordar.
- **Diffs pequenos.** Sem refatoração não pedida no meio de outra tarefa.
- **Não amplie o escopo.** Fora do marco atual vai para `docs/V2.md`.
- **Seja direto e honesto.** Se uma decisão minha for ruim, diga. Se não souber algo, diga em vez de inventar.
- **Não invente APIs nem flags.** Se depender de detalhe que pode ter mudado, confira na documentação.
- Quando houver decisão relevante, registre direto em `docs/DECISOES.md` e me comunique. Não espere aprovação.
- Sempre mande um commit depois de um prompt;
- Sempre me diga o que testar depois de cada Prompt;
