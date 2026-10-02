# Prompts avulsos (os que foram escritos no chat, fora dos marcos)

Cole sempre depois da ABERTURA.md.

## 1. Terminal executor: fechar o M4a.1

```
O último commit foi "M4a.1 (partes 1 e 2)". Leia docs/prompts-dev/M4a1.md. Sem alterar nada ainda: compare o que existe no repositório com cada item das partes 1, 2 e 3, rode typecheck, testes e build, e me diga o que está feito, o que falta e o que está quebrado. Depois faça só a Parte 3 (regra de segredos no templates/prompts-de-sessao/00-abrir-sessao.md), mostrando o texto antes de gravar. Não comece o M4b.
```

## 2. Terminal planejador (só leitura): ajustar prompts ao código real

Rode depois que o M4b estiver commitado, para ele ver o código final. Não rode ao mesmo tempo que o executor edita src/.

```
Leia o CLAUDE.md, docs/DECISOES.md e docs/prompts-dev/M5.md e M6.md. Esses prompts foram escritos sem acesso ao código real. Você NÃO pode alterar nada fora de docs/prompts-dev/. Confira o que o repositório tem hoje e reescreva M5.md e M6.md ajustando nomes de arquivos, funções e formatos ao que existe de fato. Mostre o diff e não implemente nada. Se encontrar divergência entre o CLAUDE.md e o código, liste no fim, sem corrigir.
```

## 3. Versão genérica do planejador (para qualquer marco)

```
Leia o CLAUDE.md, docs/DECISOES.md e docs/prompts-dev/<MARCO>.md. Esse prompt foi escrito sem acesso ao código real. Você NÃO pode alterar nada fora de docs/prompts-dev/. Confira o que o repositório tem hoje e reescreva o <MARCO>.md ajustando nomes de arquivos, funções e formatos ao que existe de fato. Mostre o diff e não implemente nada.
```

## 4. Corrigir o comando ui (já incluído como Parte 0 do M4b)

Use isto sozinho só se quiser corrigir o ui antes de começar o M4b.

```
O comando lore-pack ui responde "Comando desconhecido" depois de npm run build e npm link. Reproduza e descubra a causa antes de corrigir (comando não registrado em src/index.ts, dist ou link desatualizados, ou arquivos estáticos do front não copiados para o dist). Mostre o diagnóstico. Depois corrija de forma que não volte: uma única lista de comandos usada tanto no registro quanto no --help; o build copia os arquivos estáticos para o dist; scripts relink (build + npm link) e verify:dist; testes que falham se um comando da lista não aparecer na ajuda e se os estáticos não estiverem no dist; smoke test do servidor (com token 200, sem token 401 ou 403, estático 200). Não comece nenhum marco novo.
```

## 5. Bloco de instruções da IA dentro da pasta da história

Já está na Parte 1 do M4b (CLAUDE.md e AGENTS.md criados pelo init, e comando atualizar-instrucoes). Não precisa colar no M4a.1.
