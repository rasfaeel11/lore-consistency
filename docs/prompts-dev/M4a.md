Marco M4a: app local (servidor, barra lateral, nova sessão). Abra uma sessão nova, cole a ABERTURA e depois isto.

## Copie a partir daqui

Objetivo: o comando lore-pack ui abre no navegador um app com barra lateral de capítulos e sessões e um formulário de nova sessão. Ainda sem terminal: o pacote aparece com um botão de copiar.

Antes de codar, me apresente um plano curto da estrutura (pastas, rotas, como o front é servido) e espere eu aprovar.

Requisitos:
1. lore-pack ui [pasta] [--porta N]: sobe um servidor HTTP com o módulo http do Node e abre o navegador.
2. Segurança, obrigatório:
   - escutar só em 127.0.0.1;
   - gerar um token aleatório a cada execução, colocado na URL que o comando abre; toda rota da API exige o token;
   - rejeitar requisições cujo cabeçalho Host não seja 127.0.0.1 ou localhost (proteção contra DNS rebinding);
   - nenhuma rota lê ou escreve fora da pasta da história (bloquear caminhos com .. e absolutos).
   Explique cada item no "Pra estudar".
3. API (JSON), sempre chamando o núcleo, nunca duplicando lógica: listar capítulos e sessões; criar capítulo; criar sessão (mesmas opções do sessao nova) devolvendo o resumo do pack (fichas, motivo, tokens por seção); ler o pacote de uma sessão; rodar o check e devolver os problemas.
4. Front sem framework e sem etapa de build: HTML, CSS e módulos JavaScript servidos pelo próprio servidor (pasta src/ui/static ou parecida; confirme que ela entra no pacote publicado).
   - Barra lateral fixa: capítulos com título; sessões de cada capítulo embaixo, com status. Botão "Novo capítulo".
   - Botão "Nova sessão": formulário com capítulo, plano da cena (área de texto), incluir e excluir fichas, alfabeto sim ou não.
   - Depois de criar: resumo do pack (fichas e por que entraram, tokens por seção, aviso de limite) e o pacote com botão "Copiar".
   - Painel de problemas do check, se houver.
5. Mensagens de erro da API viram mensagens legíveis na tela.

Testes:
- rotas da API com o servidor numa porta efêmera: sem token recusa, Host errado recusa, caminho com .. recusa, criar sessão funciona na fixture;
- a interface é testada à mão: me dê uma checklist curta para eu seguir.

Critério de aceite: rodo lore-pack ui na minha pasta, vejo os capítulos na barra lateral, crio uma sessão pelo formulário e copio o pacote.

Não faça: terminal embutido, apply, framework de front, nenhuma dependência nova sem me consultar.

No fim, atualize o "Status atual" para M4b e dê o "Pra estudar".
