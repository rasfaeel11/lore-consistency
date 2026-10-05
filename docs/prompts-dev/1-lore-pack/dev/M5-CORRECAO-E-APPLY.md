Correção do CLAUDE.md + implementação do M5. Abra uma sessão nova, cole a ABERTURA e depois isto.

## Copie a partir daqui

Este prompt tem duas partes, nesta ordem: (A) corrigir divergências entre o CLAUDE.md e o código, num commit só de documentação; (B) implementar o M5. Não misture as duas nos commits.

## Parte A: corrigir o CLAUDE.md (só documentação, sem tocar em `src/`)

Um planejador comparou o CLAUDE.md com o código e achou as divergências abaixo. **Confira cada uma no repositório antes de corrigir**; se alguma não se confirmar, não mexa e me diga. Mude só o necessário (diffs pequenos), no estilo do texto que já existe.

1. **Lista de comandos (seção Arquitetura, linha de `cli/`):** diz "init, check, pack, capitulo, sessao, ui". O código (`src/cli/commands.ts`) também tem `atualizar-instrucoes`. Corrija. (O `apply` entra na Parte B.)
2. **Caminho dos prompts de desenvolvimento:** a árvore mostra `docs/prompts-dev/`; os prompts reais estão em `docs/prompts-dev/1-lore-pack/dev/` (marcos), `.../sessao-de-escrita/` (modelos de sessão), mais `2-fluxo-manual-original/` e `3-lore-checker-arquivado/`. Ajuste a árvore e diga que o `LEIAME.md` da pasta é o índice.
3. **Árvore de `src/` incompleta:** acrescente o que existe e não aparece: `src/core/terminal-config.ts` (config do terminal), `src/server/command.ts` (resolve o comando no PATH), `src/server/terminal.ts` (terminais e WebSocket), `src/cli/guard.ts`, `src/cli/instrucoes.ts`, `src/cli/open-browser.ts`; em `templates/`, o `lore-pack.config.json`; na raiz, `.github/workflows/ci.yml`. Mantenha a árvore enxuta: uma linha por pasta quando der, sem listar arquivo por arquivo o que já está coberto pela descrição.
4. **Seção "Capítulos e sessões", sobre o `fechamento.md`:** diz que ele aparece "depois de fechada". No código, a IA escreve `sessoes/<id>/fechamento.md` com a sessão **aberta** (veja `buildStartPrompt` e `buildSessionFilesBlock` em `src/core/session.ts`), e o `sessao fechar --fechamento <arquivo>` só copia um arquivo para lá e recusa se ele já existir. Reescreva a frase para dizer isso. Mencione também que `alteracoes-diretas.md` é gerado pelo "Manter" da guarda, se ainda não estiver dito.
5. **Seção "Formato da ficha":** confira se os tipos e pastas batem com `src/core/ficha.ts` (`TIPOS`, `FOLDER_BY_TIPO`) e se a regra do `id` bate com `idField`. Só corrija se divergir.
6. **Nome:** o CLAUDE.md e o `package.json` dizem `lore-pack` e a pasta do repositório se chama `lore-consistency`. Não renomeie nada; só confirme que não há nenhuma menção ao nome da pasta dentro dos arquivos do projeto que precise de ajuste, e me diga o resultado.

Não altere o `COMECE-AQUI.md`, `docs/V2.md` (o M5 cuida do V2) nem os prompts do M6: o M6 já trata disso. Mostre o diff do CLAUDE.md, faça o commit ("Corrige o CLAUDE.md conforme o código") e só então siga para a Parte B.

## Parte B: implementar o M5

Leia `docs/prompts-dev/1-lore-pack/dev/M5.md` **inteiro** e siga o que está depois de "Copie a partir daqui". Ele já foi ajustado ao código real: nomes de arquivos, funções e decisões (CLI sem perguntas e com `--aplicar`, snapshot novo depois de aplicar, `aplicado.json`, fechar sessão como ação separada, `estado_substituir`, texto do prompt 04 só vale para pastas novas, commit automático fora do escopo). Siga esse arquivo como a especificação; este prompt não a substitui.

Lembretes que valem para a Parte B inteira, vindos do CLAUDE.md:

- Mostre o plano curto e **espere eu concordar** antes de escrever código. Mostre também o texto novo do `templates/prompts-de-sessao/04-fechar-sessao.md` e espere eu aprovar antes de gravar.
- Testes primeiro: escreva, rode, veja falhar, depois implemente. Passos pequenos, sem refatorar o que não foi pedido.
- Antes de dar o trabalho por pronto, rode `npm run typecheck`, `npm test` e `npm run build && npm run verify:dist`, e me diga o resultado real (se algo falhar, mostre a saída).
- Registre as decisões em `docs/DECISOES.md` e comunique. Ideias fora do escopo vão para `docs/V2.md`.
- Atualize o CLAUDE.md: "Status atual" para M6, a lista de comandos (agora com `apply`) e a seção "Capítulos e sessões" com o formato do fechamento (bloco `lore-pack-mudancas`, `aplicado.json`).
- Faça o commit no fim (a Parte B pode ter mais de um commit, um por parte do M5), diga o que eu devo testar à mão (siga o `docs/CHECKLIST-M5.md` que você vai criar) e termine com "Pra estudar" (2 ou 3 pontos).

No fim, liste: o que a Parte A mudou, o que a Parte B entregou, o que ficou de fora e foi para o V2, e qualquer divergência nova que você achou entre o CLAUDE.md, o M5.md e o código.
