# Teste com usuários (roteiro de 20 minutos)

Para testar o lore-pack com 2 ou 3 pessoas que escrevem ficção. O objetivo não é mostrar a ferramenta: é ver onde a pessoa trava sozinha.

## Quem chamar
- Pessoas que já escrevem histórias longas (ou campanhas de RPG) e já usaram alguma IA para isso.
- **Pelo menos uma que não usa Claude Code**, e de preferência nem terminal: ela faz o caminho de "copiar o pacote" e colar no Gemini ou no ChatGPT (princípio 9: nada amarrado a uma IA).
- Ninguém que tenha visto o projeto sendo feito.

## Antes de começar
- Instale o lore-pack no computador da pessoa (ou leve o seu) e confira `lore-pack --version`.
- Peça para ela trazer uma ideia de história com dois personagens e um lugar. **Não use a sua história** (princípio 7).
- Tenha uma IA de chat aberta numa aba, já logada.
- Diga: "Estou testando a ferramenta, não você. Pense em voz alta. Eu não vou ajudar, a não ser que você fique mais de dois minutos parado."
- Se a pessoa deixar, grave a tela. Senão, anote.

## Tarefas (diga só a frase em negrito)

| # | Tempo | Tarefa | O que observar |
|---|---|---|---|
| 1 | 3 min | **"Crie a pasta da sua história e me diga o que você acha que cada arquivo é."** (`lore-pack init`) | Ela abre o `COMO-USAR.md`? Entende a diferença entre bíblia, estado e ficha? Estranha algum nome de arquivo? |
| 2 | 4 min | **"Cadastre um personagem e um lugar."** | Acha o modelo de ficha? Erra o `id` ou o `tipo`? Roda o `check` sozinha? Entende a mensagem de erro sem ajuda? |
| 3 | 4 min | **"Prepare a IA para escrever a primeira cena."** (capítulo, plano, sessão, pacote) | Descobre que precisa de um capítulo antes? Escreve o plano citando os nomes? Entende a lista "fichas no pacote" e a contagem de tokens? Pela CLI ou pelo `ui`? |
| 4 | 4 min | **"Escreva a cena com a IA."** | Acha o `pacote.md` ou o botão "Copiar pacote"? Cola na IA sem medo? Com terminal embutido: entende o que abriu? |
| 5 | 5 min | **"A cena criou fatos novos. Atualize os arquivos da história."** (prompt 04, `apply` ou a seção "Fechamento") | Acha o prompt 04? Sabe onde colar a resposta? Lê o diff ou aplica tudo sem olhar? Entende que pode aplicar só uma parte? Fecha a sessão? |

Se uma tarefa passar muito do tempo, anote onde travou, dê a resposta e siga.

## Perguntas no fim
1. Em que momento você ficou mais perdido?
2. O que você esperava que acontecesse e não aconteceu?
3. Você confiaria na ferramenta para mexer nas suas fichas de verdade? O que faltaria para confiar?
4. Compare com o que você faz hoje para a IA não esquecer a história. O que é melhor e o que é pior?
5. Você usaria na semana que vem? Se não, o que precisaria mudar?

## Onde registrar
Crie `docs/testes/AAAA-MM-DD-apelido.md` para cada pessoa (apelido, nunca o nome completo), com:

- **Perfil:** o que escreve, quais IAs usa, usa terminal ou não.
- **Por tarefa:** conseguiu sozinha / com ajuda / não conseguiu, e a frase exata que ela disse quando travou.
- **Respostas** às cinco perguntas.
- **O que mudar:** no máximo três itens, em ordem de importância.

Depois dos testes, o que se repetir em duas pessoas vira tarefa. O que apareceu uma vez só vai para `docs/V2.md`.
