# lore-pack

> Nome provisório. Antes de publicar, confirmar se o nome está livre no npm.

Ferramenta para quem escreve histórias com ajuda de IA. Organiza o mundo da história em fichas (markdown) e monta o **pacote de contexto** de cada sessão de escrita: bíblia + estado + só as fichas relevantes + última cena, com estimativa de tokens. Funciona com qualquer IA (Claude, Gemini, ChatGPT): a ferramenta gera o texto e o usuário cola. Sem API, sem conta, sem pagamento.

## Status atual

- Marco em andamento: **M3** (publicação)
- Atualize esta linha ao fechar cada marco.

## Roteiro

| Marco | Entrega | Versão |
|---|---|---|
| M0 | Esqueleto: TypeScript, testes, CLI que roda | |
| M1 | `init` (cria a pasta da história a partir de `templates/`) e `check` (valida as fichas) | v0.1 |
| M2 | `pack` (acha as fichas da cena, monta o pacote, estima tokens) | v0.1 |
| M3 | Publicação: CI no GitHub, pacote no npm, README com GIF, mundo de exemplo | v0.1 |
| M4 | `apply`: aplica as mudanças do fechamento de sessão, com diff e confirmação | v0.2 |
| M5 | Checagem de nomes contra o `alfabeto.md` (repetidos ou parecidos) | v0.3 |
| M6 | Interface web estática sobre o mesmo núcleo | v1.0 |

Fora do escopo até a v1: chamar API de IA, contas de usuário, servidor, sincronização na nuvem, editor de texto próprio. Ideia nova vai para `docs/V2.md`.

## Princípios

1. **O núcleo é puro.** `src/core/` só tem funções que recebem dados e devolvem dados: nada de ler disco, imprimir no terminal ou acessar rede. Isso permite reusar o mesmo núcleo na CLI e, depois, na web.
2. **Entrada e saída ficam nas bordas.** `src/cli/` lê arquivos, chama o núcleo e imprime. A futura interface web será outra borda.
3. **Nada pago, nada na nuvem.** Os arquivos do usuário nunca saem do computador dele.
4. **Nunca alterar arquivo do usuário sem confirmação.** `init` recusa pasta que não esteja vazia. Comandos futuros que escrevem mostram o diff antes.
5. **Mensagens de erro úteis.** Sempre: qual arquivo, qual campo, o que está errado e como consertar. Nada de stack trace para o usuário.
6. **Poucas dependências.** Cada dependência nova precisa de motivo registrado em `docs/DECISOES.md`.
7. **Nenhuma história real no repositório.** Só templates e exemplos inventados. O autor usa a ferramenta na própria história em outra pasta, privada.

## Arquitetura

```
src/
  core/        # funções puras: schema da ficha, validação, (M2) montagem do pacote
  cli/         # comandos: init, check, (M2) pack. Lê e escreve arquivos.
  index.ts     # ponto de entrada da CLI
templates/     # o que o `init` copia para a pasta da história
tests/
  fixtures/    # pastas de história de teste (válidas e inválidas)
docs/
  DECISOES.md  # diário de decisões
  V2.md        # ideias adiadas
  prompts-dev/ # prompts para construir o projeto com o Claude Code (não são do produto)
```

## Formato da ficha

Markdown com cabeçalho YAML, em `fichas/<tipo>/<id>.md`. Modelo em `templates/modelos/ficha-modelo.md`.

- `id`: obrigatório, minúsculas sem acento, números e hífen, igual ao nome do arquivo sem `.md`, único na pasta inteira.
- `tipo`: obrigatório, um de `personagem`, `lugar`, `faccao`, `objeto`.
- `nome`: obrigatório, não vazio.
- `aliases`: opcional, lista de textos (outros nomes, apelidos, títulos). Usado no M2 para achar a ficha numa cena.
- `status`: opcional, texto.
- `aparece_em`: opcional, lista de textos.
- O corpo é livre (markdown).

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
