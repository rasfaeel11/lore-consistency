Marco M4b (versão revisada): correção do comando ui, instruções para a IA dentro da pasta, terminal embutido e guarda do cânone. Abra uma sessão nova, cole a ABERTURA e depois isto.

## Copie a partir daqui

Este marco é grande. Trabalhe em partes, faça um commit ao fim de cada uma e PARE nos checkpoints marcados, esperando eu confirmar. 

### Parte 0 — Pré-requisitos e correção do ui (pare se algo falhar)

0.1 Verifique o que existe e me diga: o app do M4a (comando ui, servidor, front) e o M4a.1 (pasta referencias/, tipos povo e conceito, regra de segredos no prompt 00). Se o M4a.1 não foi feito, pare e me avise; ele vem antes.

0.2 Bug conhecido: depois de npm run build e npm link, lore-pack --help não lista o comando ui, e lore-pack ui responde: Comando desconhecido: "ui". Reproduza e descubra a causa antes de corrigir. Hipóteses: (a) o comando não foi registrado em src/index.ts; (b) o dist/ ou o link estão desatualizados; (c) os arquivos estáticos do front não são copiados para o dist/ (o tsc só compila TypeScript). Mostre o diagnóstico.

0.3 Corrija de forma que o problema não volte:
- Uma única lista de comandos, usada tanto para registrar quanto para montar o --help. Nada de duas listas que podem divergir.
- O build copia os arquivos estáticos do front para o dist/ (e o campo "files" do package.json inclui tudo o que o app precisa).
- Scripts: relink (build + npm link) e verify:dist (roda o dist com --help e confere se todos os comandos da lista aparecem, e se os arquivos estáticos existem).

0.4 Testes:
- falha se algum comando da lista única não aparecer na saída do --help;
- smoke test do servidor: sobe em porta efêmera; GET na raiz com token devolve 200 e HTML; sem token devolve 401 ou 403; um arquivo estático (css ou js) devolve 200;
- verify:dist roda no CI depois do build.

0.5 O comando ui abre o navegador sem dependência nova (spawn com lista de argumentos por plataforma: start no Windows, open no macOS, xdg-open no Linux), e SEMPRE imprime a URL completa com o token, para eu copiar caso o navegador não abra.

CHECKPOINT: me peça para rodar lore-pack ui na minha pasta de história e confirmar que a página abre. Só siga depois da minha confirmação.

### Parte 1 — Instruções para a IA dentro da pasta da história

1.1 O init passa a criar CLAUDE.md e AGENTS.md (mesmo conteúdo) na pasta da história. Conteúdo curto, até umas 60 linhas:
- o que é cada pasta (fichas, referencias, sessoes, capitulos, biblia, estado, alfabeto);
- o formato exato da ficha e da referência, com um exemplo de cada, e os tipos permitidos (personagem, lugar, faccao, objeto, povo, conceito);
- regras duras:
  1. nunca editar diretamente biblia.md, estado.md, alfabeto.md, fichas/, referencias/ nem capitulos/;
  2. a IA só pode escrever em sessoes/<id>/rascunho.md (texto de cenas) e sessoes/<id>/fechamento.md (propostas de mudança, no formato do prompt 04);
  3. nada vira cânone sem aprovação do autor;
  4. segredos (seções de Segredos das fichas e referências) servem para coerência e nunca aparecem no texto da história sem o autor pedir;
  5. se algo não está nos arquivos, perguntar em vez de inventar.
Mostre o texto e espere eu aprovar antes de gravar.

1.2 Comando atualizar-instrucoes: atualiza esses dois arquivos em pastas criadas antes. Guarde em .lore-pack/ o hash da última versão gerada; se o autor editou o arquivo depois, mostre o diff e pergunte antes de sobrescrever.

1.3 Atualize o buildStartPrompt do M3 (e o pacote gerado) para a instrução inicial dizer: leia o pacote da sessão; escreva rascunhos em sessoes/<id>/rascunho.md; ao final, escreva as propostas em sessoes/<id>/fechamento.md; não edite nenhum outro arquivo.

### Parte 2 — Terminal embutido (backend)

2.1 Antes de codar, confirme na documentação ATUAL e me reporte: o nome exato e a forma de usar o pacote do terminal para o navegador e do addon de redimensionamento (pacotes do xterm.js); o node-pty (versão atual, se há binários pré-compilados, o que exige em Windows, Linux e macOS); a biblioteca ws; e como servir os arquivos do xterm sem etapa de build (por exemplo, copiar de node_modules para a pasta estática no build). Não chute nenhum nome ou versão. Proponha o texto para docs/DECISOES.md, incluindo a decisão de aceitar essas dependências.

2.2 O node-pty deve ser dependência OPCIONAL, carregada com import dinâmico. Se não instalar ou não carregar na máquina, o app continua funcionando: o terminal fica desligado e a interface explica o motivo e oferece o botão de copiar o pacote. Teste e me reporte se npm install funciona em máquina limpa, sem compilador.

2.3 Configuração em lore-pack.config.json na pasta da história (o init cria com o padrão):
- terminal.comando (padrão "claude");
- terminal.args, lista em que {{prompt}} é trocado pela instrução de início (padrão ["{{prompt}}"]);
- terminal.comando = "nenhum" desliga o terminal.
Validar com Zod, com mensagem de erro legível. REGRA DE SEGURANÇA: o comando e os argumentos vêm SOMENTE desse arquivo no disco. Nenhuma requisição HTTP ou mensagem de WebSocket pode definir comando, argumentos, diretório ou variáveis de ambiente. O cliente só pode pedir "abrir terminal para a sessão X".

2.4 WebSocket por terminal, com as mesmas regras do M4a e mais:
- exigir o token;
- verificar o cabeçalho Origin (precisa ser exatamente http://127.0.0.1:<porta> ou http://localhost:<porta>) e o Host; recusar o upgrade caso contrário (proteção contra páginas de terceiros abrindo WebSocket no seu computador);
- limite de tamanho de mensagem e máximo de terminais simultâneos (por exemplo, 4);
- mensagens de entrada, redimensionamento e saída.
Explique cada item no "Pra estudar".

2.5 Spawn do processo: diretório de trabalho é a pasta da história; argumentos como lista, NUNCA montando string de shell com texto de usuário; TERM=xterm-256color; no Windows, resolva explicitamente .cmd e .exe e documente o comportamento; se o comando configurado não existir, erro claro dizendo o que instalar ou como trocar na configuração.

2.6 Ciclo de vida: fechar a aba encerra o processo; encerrar o lore-pack ui encerra todos os filhos (inclusive em Ctrl+C); processo que termina avisa o front com o código de saída; recarregar a página reanexa ao mesmo terminal enquanto o processo vive, usando um buffer curto da saída recente (por exemplo, 100 KB).

CHECKPOINT: com um comando inofensivo (node -e com um console.log), me mostre o terminal funcionando pelo WebSocket antes de seguir para o front.

### Parte 3 — Front do terminal

3.1 Na sessão, botão "Abrir terminal". Abas, uma por terminal aberto, com indicador de estado (rodando ou encerrado, e código de saída). Redimensionar a janela redimensiona o terminal. Copiar e colar funcionam.
3.2 O terminal abre rodando o comando configurado, com {{prompt}} igual à instrução da 1.3.
3.3 O botão "Copiar pacote" fica sempre disponível, mesmo com o terminal ligado.
3.4 Layout: painel dividido, terminal de um lado e plano e pacote do outro; a barra lateral continua visível.
3.5 Se o terminal estiver desligado (config "nenhum" ou node-pty indisponível), mostrar o motivo na própria tela.

### Parte 4 — Guarda do cânone

Objetivo: se a IA dentro do terminal mexer em arquivo protegido, eu descubro e posso desfazer.

4.1 Ao abrir um terminal de uma sessão, tire um snapshot (hash e cópia) dos arquivos protegidos: biblia.md, estado.md, alfabeto.md, fichas/, referencias/, capitulos/. Guarde em .lore-pack/snapshots/<sessao>/ (fora do git; o check ignora essa pasta).
4.2 Compare o estado atual com o snapshot quando: o terminal encerra, eu clico em "Verificar alterações", e eu fecho a sessão. Se houver mudança em arquivo protegido, mostre um aviso bem visível com a lista de arquivos e o diff de cada um, e duas ações: Reverter (restaura do snapshot, com confirmação) e Manter (registra a decisão em sessoes/<id>/alteracoes-diretas.md).
4.3 Exceções permitidas: sessoes/<id>/rascunho.md e sessoes/<id>/fechamento.md.
4.4 Documente com honestidade que isso é detecção depois do fato, não bloqueio. O bloqueio de verdade vem da validação do apply (M5).
4.5 Pesquise na documentação atual do Claude Code se existe uma forma de restringir escrita por configuração (por exemplo, regras de permissão em arquivo de configuração do projeto). Se existir, PROPONHA o conteúdo para o init gerar, mas não aplique sem eu aprovar.

### Testes (cada parte com os seus)

- config: válida, inválida, "nenhum"; {{prompt}} substituído; nenhum caminho aceita comando vindo de requisição (teste que tenta e é recusado);
- WebSocket: sem token recusa; Origin errado recusa; Host errado recusa; mensagem grande demais recusa; passando o limite de terminais recusa;
- terminal de verdade com um comando inofensivo: recebe a saída; o resize não quebra; fechar a aba mata o processo; encerrar o servidor não deixa processo órfão;
- node-pty ausente: o app sobe, o terminal aparece desligado com o motivo;
- guarda: alterar, apagar e criar arquivo protegido é detectado; rascunho.md e fechamento.md não disparam; Reverter restaura exatamente; Manter registra;
- atualizar-instrucoes: não sobrescreve arquivo editado sem perguntar;
- checklist manual curta para eu seguir com o Claude Code de verdade, incluindo: abrir terminal, pedir para a IA editar uma ficha (a guarda tem que acusar), pedir um rascunho (não pode acusar).

### Critério de aceite

Crio uma sessão no app, clico "Abrir terminal", o Claude Code abre dentro do app já lendo o pacote e escrevendo rascunho e fechamento nos arquivos da sessão. Se eu forçar a IA a editar uma ficha, o app acusa e eu consigo reverter. Sem o node-pty instalado, o app continua útil com o botão de copiar.

### Não faça

Retomar conversas antigas da IA (registre em docs/V2.md; depende das opções da CLI), aplicar fechamento (isso é o M5), framework de front, ou qualquer dependência além de xterm, addon de redimensionamento, node-pty e ws (cada uma registrada em docs/DECISOES.md).

No fim, atualize o "Status atual" do CLAUDE.md para M5 e dê o "Pra estudar".
