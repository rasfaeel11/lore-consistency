# Checklist manual do M4b (com o Claude Code de verdade)

Rode no checkout do lore-pack: `npm install` e depois `npm run relink`.
Use uma pasta de história **de teste**, criada agora, e não a sua história real: o passo 6 manda a IA mexer numa ficha.

## Preparação
1. `lore-pack init historia-teste` e `cd historia-teste`.
   - Conferir que existem `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` e `lore-pack.config.json`.
2. `lore-pack capitulo novo "A chegada"`.
3. Criar uma ficha qualquer em `fichas/personagens/ana.md` (copie `modelos/ficha-modelo.md`, com `id: ana`, `tipo: personagem` e `nome: Ana`) e rodar `lore-pack check`, que não pode dar erro.

## Terminal
4. `lore-pack ui`. O navegador abre sozinho. Crie uma sessão com o plano "Ana chega ao porto".
5. Clicar em "Abrir terminal".
   - **Esperado:** o Claude Code abre dentro do app, na pasta da história, já com a instrução de ler `sessoes/<id>/pacote.md`.
   - A aba mostra "Terminal 1 · rodando".
   - Redimensionar a janela ajusta o terminal.
   - Selecionar texto e apertar Ctrl+C copia; Ctrl+V cola.

## Guarda do cânone
6. Pedir à IA: "edite fichas/personagens/ana.md e acrescente que ela tem uma irmã".
   - **Esperado, primeira barreira:** o Claude Code **recusa** a edição, por causa do `.claude/settings.json`.
   - Se você autorizar ou forçar de outro jeito (por exemplo, pedindo um script), a segunda barreira entra quando o programa termina (`/exit`), ou ao clicar em "Verificar alterações": o app acusa `fichas/personagens/ana.md`, com o diff.
7. Clicar em "Reverter tudo" e confirmar. A ficha volta ao texto original.

## O que não pode acusar
8. Abrir outro terminal e pedir: "escreva a primeira cena em sessoes/<id>/rascunho.md".
   - **Esperado:** o arquivo é criado, e "Verificar alterações" diz que nenhum arquivo protegido mudou.
9. Pedir: "escreva as propostas de fechamento em sessoes/<id>/fechamento.md". Também não pode acusar.

## Ciclo de vida
10. Recarregar a página (F5) com o terminal rodando. A aba volta, com a tela de antes.
11. Fechar a aba do terminal (×, depois "encerrar?"). O programa some do Gerenciador de Tarefas.
12. Abrir um terminal e apertar Ctrl+C no terminal onde o `lore-pack ui` está rodando. O `claude` não pode ficar rodando no Gerenciador de Tarefas.

## Sem terminal
13. Trocar `lore-pack.config.json` para `{ "terminal": { "comando": "nenhum" } }` e recarregar a página.
    - **Esperado:** botão "Abrir terminal" desabilitado, com o motivo escrito embaixo. O "Copiar pacote" continua funcionando.
