# Checklist manual do M5 (apply: aplicar o fechamento com aprovação)

Rode no checkout do lore-pack: `npm install` e depois `npm run relink`.
Use uma pasta de história **de teste**, criada agora, e não a sua história real: os passos gravam em fichas e no estado.

## Preparação
1. `lore-pack init historia-teste` e `cd historia-teste`.
2. `lore-pack capitulo novo "A chegada"`.
3. Criar `fichas/personagens/ana-ferreira.md` a partir de `modelos/ficha-modelo.md`, com `id: ana-ferreira`, `tipo: personagem`, `nome: Ana Ferreira` e `status: viva`. Em `estado.md`, escrever uma frase embaixo de `## Resumo geral`, por exemplo "Ana procura o farol.". Rodar `lore-pack check`, que não pode dar erro.
4. Conferir que `prompts-de-sessao/04-fechar-sessao.md` pede o bloco `lore-pack-mudancas` no fim.

## No app, com a resposta colada (caminho de quem usa Gemini ou ChatGPT)
5. `lore-pack ui`. Criar uma sessão com o plano "Ana Ferreira chega ao farol".
6. Numa IA de chat: colar o pacote ("Copiar pacote"), escrever uma cena curta e depois colar o prompt `04-fechar-sessao`.
   - Sem IA à mão, use como resposta o bloco de exemplo que está dentro do próprio `04-fechar-sessao.md` (ele cita `ana-ferreira` e a frase "Ana procura o farol.").
7. Na sessão, seção "Fechamento": colar a resposta e clicar em "Ler fechamento".
   - **Esperado:** some a caixa de colar, aparece "Lido de sessoes/<id>/fechamento.md", e a lista numerada das mudanças, cada uma com caixa marcada, o arquivo e o diff. O item "não aprovado" aparece sem caixa.
   - Nenhum arquivo mudou ainda: `git status` (ou olhar o `estado.md`) confirma.
8. Desmarcar metade das caixas e clicar em "Aplicar selecionadas".
   - **Esperado:** o botão vira "Confirmar: aplicar N mudanças". Clicar em "Cancelar" volta atrás sem gravar.
9. Clicar de novo em "Aplicar selecionadas" e em "Confirmar".
   - **Esperado:** só as mudanças marcadas aparecem nas fichas, no `estado.md` e no `alfabeto.md`.
   - Embaixo: "Check depois de aplicar: Tudo certo: ...".
   - As aplicadas passam a aparecer como "(já aplicada)", sem caixa. As outras continuam disponíveis.
   - A sessão continua **aberta**.
10. Clicar em "Verificar alterações" (guarda do cânone).
    - **Esperado:** "Nenhum arquivo protegido mudou": a guarda não acusa o que você aprovou.
11. Recarregar a página (F5). A lista volta igual, com as aplicadas marcadas como aplicadas.
12. Clicar em "Fechar sessão" e em "Confirmar: fechar esta sessão".
    - **Esperado:** a sessão aparece como "fechada" na barra lateral, e o botão "Fechar sessão" some.

## Na CLI
13. Criar outra sessão (`lore-pack sessao nova --capitulo cap-01 --plano plano.md`) e salvar uma resposta do prompt 04 em `sessoes/<id>/fechamento.md`.
14. `lore-pack apply <id>`.
    - **Esperado:** a lista numerada com o diff de cada operação e, no fim, "Nada foi gravado" com os comandos para aplicar. Nenhum arquivo mudou.
15. `lore-pack apply <id> --aplicar 1,2`.
    - **Esperado:** só a 1 e a 2 gravadas, o resultado do check, "Ainda não aplicadas: ..." e a sugestão do `sessao fechar`.
16. Rodar o mesmo comando de novo.
    - **Esperado:** recusa com "A operação 1 já foi aplicada." e nenhuma linha repetida nos arquivos.
17. `lore-pack apply <id> --aplicar todas`, depois `lore-pack sessao verificar <id>` (nada acusado) e `lore-pack sessao fechar <id>` (fecha).

## Bloco com problema
18. Numa sessão nova, colar no app um texto sem o bloco.
    - **Esperado:** o erro em vermelho, o pedido de correção pronto e o botão "Copiar pedido de correção". O `fechamento.md` **não** é criado.
19. Editar um `fechamento.md` para citar uma seção que não existe (`"secao": "Personagens"` num `estado_adicionar`) e clicar em "Reler".
    - **Esperado:** essa operação aparece com "Não dá para aplicar: A seção ... não existe", com a lista das seções que existem, e sem caixa. As outras continuam aplicáveis.

## Guarda e terminal
20. Com uma sessão aberta, editar o `biblia.md` à mão e abrir a sessão no app.
    - **Esperado:** a seção "Fechamento" mostra o aviso da guarda no lugar da lista, e `lore-pack apply <id>` recusa. Depois de "Reverter tudo" ou "Manter e registrar", a lista volta.
21. Com o Claude Code no terminal embutido: pedir o fechamento (prompt 04). Quando o programa terminar (`/exit`), a lista do fechamento aparece sozinha na página.
    - Com o terminal ainda **rodando**, "Aplicar selecionadas" recusa e pede para fechar o terminal antes.

## Pasta antiga
22. Numa pasta de história criada antes do M5, o `prompts-de-sessao/04-fechar-sessao.md` é o antigo, sem o bloco. O `apply` avisa isso na mensagem de "Não achei o bloco". Para atualizar: `lore-pack init pasta-nova-vazia` e copiar de lá o `04-fechar-sessao.md`.
