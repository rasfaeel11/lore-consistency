# Prompts para o Claude Code (um por marco)

Os prompts do **pipeline** (extrator, revisor, baseline) estão em `prompts/`. Este arquivo tem outra coisa: os prompts que **você cola no Claude Code** para construir o projeto, um marco por vez.

## Como usar

1. Um marco por sessão. Ao terminar, faça commit, atualize "Status atual" no `CLAUDE.md` e abra uma sessão nova (ou use `/clear`).
2. Comece sempre pelo prompt de abertura abaixo, depois cole o prompt do marco.
3. Para aprender em vez de receber pronto, acrescente **"modo guiado"** ao fim de qualquer prompt. O `CLAUDE.md` já diz o que isso significa.
4. Leia o diff antes de aceitar. Se não entendeu algo, pergunte antes de seguir.
5. Se o Claude Code propuser algo fora do escopo, peça pra registrar em `docs/V2.md`.

## Abertura de sessão (cole sempre primeiro)

```
Leia o CLAUDE.md inteiro, depois canon-demo/README.md e prompts/README.md.
Não escreva código ainda. Responda em poucas linhas: em que marco estamos,
o que já existe no repositório e o que você entendeu que falta para fechar
este marco. Depois espere minha instrução.
```

## M0. Esqueleto do projeto

```
Objetivo: criar o esqueleto do projeto, sem nenhuma lógica de negócio.

Faça:
- Inicializar git e npm. TypeScript em modo strict, Vitest para testes, tsx
  para rodar scripts. Só as dependências necessárias para isso.
- Criar as pastas de src/ descritas no CLAUDE.md, cada uma com um arquivo
  index.ts vazio ou com um comentário dizendo a responsabilidade do módulo.
- Scripts no package.json: test, typecheck, index, eval, check:demo (os três
  últimos podem só imprimir "não implementado" por enquanto).
- .gitignore adequado (node_modules, o arquivo do índice SQLite, saídas de eval).
- Um teste trivial para provar que npm test funciona.

Critério de aceite: npm install, npm run typecheck e npm test passam do zero.

Não faça: nenhuma lógica de fichas, nenhum provedor de IA, nenhuma dependência
além de TypeScript, Vitest e tsx.

No fim, dê o "Pra estudar".
```

## M1. Formato das fichas e índice SQLite

```
Objetivo: ler as fichas de canon-demo/, validar o formato e gerar o índice SQLite.

Contexto: o formato das fichas está em canon-demo/README.md e há 15 fichas reais
em canon-demo/entities, events e rules.

Faça, testes primeiro:
1. Schema Zod em src/canon/schema.ts para os tipos de ficha (personagem, lugar,
   faccao, evento, regra) e para fato (campo restrito ao enum do README).
2. Leitor em src/canon/ que lê um arquivo markdown com frontmatter YAML e devolve
   a ficha validada mais o corpo.
3. Validações além do schema: o id bate com o nome do arquivo; cada citacao de
   cada fato é um trecho literal do corpo; ids únicos no cânone inteiro.
4. Erros claros: caminho do arquivo, campo e motivo. Nada de stack trace cru.
5. npm run index: lê todo o canon-demo e grava um SQLite com tabelas de entidades,
   fatos e regras. O arquivo do índice é regenerável e ignorado pelo git.

Testes obrigatórios:
- as 15 fichas de canon-demo carregam sem erro;
- fixtures inválidas em tests/fixtures/: falta de id, campo fora do enum, citação
  que não está no corpo, id diferente do nome do arquivo, id duplicado. Cada uma
  precisa produzir o erro esperado.

Critério de aceite (definição de pronto do M1): uma ficha malformada é
rejeitada com mensagem que diz o que consertar, e o índice é gerado a partir
das fichas válidas.

Não faça: nada de IA, nada de checagens, nada de interface.
```

## M2. Verificador do mundo de demonstração

```
Objetivo: transformar a verificação do dataset de demo em um comando do projeto.

Contexto: canon-demo/eval/contradicoes.yaml tem 21 contradições plantadas e
canon-demo/eval/nao_contradicoes.yaml tem 8 armadilhas. Os textos estão em
canon-demo/texts/.

Faça, testes primeiro:
- npm run check:demo, que confere:
  1. o YAML dos dois arquivos é válido e os ids são únicos;
  2. cada citacao_nova é um trecho literal do texto indicado e aparece uma
     única vez nele;
  3. cada citacao_canone é trecho literal da ficha indicada em fonte_canone;
  4. tipo, gravidade, afirmado_por e deterministica têm valores válidos;
  5. o texto 05-controle.md não tem nenhuma entrada no gabarito.
- Saída com o resumo: quantas contradições por tipo e por valor de
  deterministica, e uma lista clara de qualquer problema encontrado.

Critério de aceite (definição de pronto do M2): o comando passa nos dados atuais,
e falha com mensagem útil se eu estragar uma citação de propósito.

Depois de passar, me diga o que você revisaria no dataset em si (fichas, textos,
gabarito). O mundo foi gerado por IA e eu ainda preciso revisar.
```

## M3. Checagens determinísticas

```
Objetivo: implementar as checagens em código que não dependem de LLM.

Contexto: src/checks/ recebe FATOS ESTRUTURADOS (o mesmo formato que o extrator
vai produzir, descrito em prompts/extract.md) e os compara com os fatos do
cânone. Ainda não existe extrator: use fixtures escritas à mão.

Faça, testes primeiro:
1. Fixtures em canon-demo/eval/fatos-esperados/NN.json, uma por texto, com os
   fatos que o extrator DEVERIA tirar de cada texto (com citacao literal).
   Gere um rascunho e me mostre para eu conferir à mão antes de tratar como verdade.
2. Interpretador simples de marcação de tempo: "ano 312", "inverno do ano 312",
   "primavera do ano 315" viram ano e, quando houver, estação (ordem: inverno
   antes de primavera antes de verão antes de outono dentro do mesmo ano).
3. Checagens, cada uma em arquivo próprio e com testes:
   - status_apos_morte: entidade com status morreu que aparece agindo em data
     posterior;
   - conflito_de_atributo: mesma entidade e mesmo campo com valores diferentes,
     para atributos exclusivos (cor dos olhos, da barba, lateralidade);
   - aritmetica_de_idade: ano de nascimento do cânone mais idade dita no texto
     contra o ano do texto;
   - regra_custo_magia (r1), regra_distancia (r2) e regra_ferro_ordem (r3),
     na medida em que os fatos estruturados permitirem. Se uma regra não puder
     ser checada de forma confiável em código, diga qual e por quê em vez de
     forçar.
4. Cada alerta sai no formato de alerta do projeto, com as duas citações.

Critério de aceite (definição de pronto do M3): dado o conjunto correto de fatos,
as checagens acham todas as contradições do gabarito com deterministica "sim" e
nenhuma das armadilhas nem do texto de controle. Reporte também quais do "parcial"
foram achadas.

Não faça: nenhuma chamada a modelo. Nenhuma checagem que dependa de interpretação
semântica (isso é papel do revisor, no M5).
```

## M4. Extrator com provedor local

```
Objetivo: extrator de fatos usando a interface de provedor, com um adaptador Ollama.

Contexto: o prompt está em prompts/extract.md (carregar o texto entre os
marcadores PROMPT START e PROMPT END, substituindo as variáveis). As fixtures
de fatos esperados estão em canon-demo/eval/fatos-esperados/.

Faça, testes primeiro:
1. Interface em src/providers/ (por exemplo completar(prompt) devolvendo texto)
   e adaptador Ollama. Confirme na documentação ATUAL do Ollama o endpoint e o
   formato de requisição, inclusive se há saída estruturada por schema. Não
   chute; se não conseguir confirmar, me diga.
2. Carregador de prompts em src/ que extrai o texto entre os marcadores e
   substitui {{variáveis}}. Erro claro se faltar variável.
3. src/extract/: monta o prompt, chama o provedor, valida a saída (JSON, schema
   Zod, citacao literal no trecho, entidade_id existente ou null). Falhou: uma
   nova tentativa; falhou de novo: descarta e registra no log.
4. Testes do extrator com um provedor FALSO (resposta fixa), sem precisar do
   Ollama rodando. Incluir casos: JSON inválido, citação inventada, id
   inexistente.
5. Comando de avaliação do extrator: roda nos 5 textos e compara com
   fatos-esperados. Métricas: fatos corretos, fatos faltando, fatos inventados
   (citação não literal conta como inventado). Correspondência por entidade,
   campo e valor normalizado.

Critério de aceite (definição de pronto do M4): relatório de acurácia da
extração nos 5 textos, rodando com um modelo local.

Depois: rode com 2 ou 3 modelos locais de 7-9B que caibam em 8 GB de VRAM e
me entregue a comparação numa tabela. Eu escolho o modelo. Registre a decisão
em docs/DECISOES.md (proponha o texto).

Não faça: não edite arquivos em prompts/ sem me avisar. Se o prompt precisar de
ajuste, proponha a mudança, mostre o número antes e depois e registre em
prompts/CHANGELOG.md.
```

## M5. Revisor com citação obrigatória e baseline

```
Objetivo: revisor LLM sobre os fatos extraídos, mais o baseline "só LLM".

Contexto: prompts/review.md (revisor) e prompts/baseline-review.md (baseline).
Os dois exigem citação literal dos dois lados, e o código valida.

Faça, testes primeiro:
1. Montador de contexto em src/review/: dados os fatos novos, pega do índice
   SQLite os fatos das entidades mencionadas e todas as regras (recuperação por
   id de entidade, sem busca vetorial). Atribui ids n1.. aos fatos novos e c1..
   aos do cânone.
2. Revisor: monta o prompt, chama o provedor, valida a saída (schema, ids
   existentes, cada citação literal da origem correta). Alerta inválido é
   descartado e registrado, nunca exibido.
3. Baseline: texto bruto do cânone e do texto novo, mesmo provedor, mesma
   validação de citação. Use a mesma interface para o experimento ser justo.
4. Comando de avaliação: roda revisor e baseline nos 5 textos e pontua contra
   contradicoes.yaml com a regra de correspondência descrita em
   canon-demo/README.md. Saída: precisão, cobertura, falsos positivos por
   texto, desempenho por valor de deterministica, e lista dos alertas que
   cairam em armadilhas.

Critério de aceite (definição de pronto do M5): relatório de acertos e falsos
positivos do revisor e do baseline nos 5 textos.

Não faça: não ajuste prompts para "melhorar o número" sem registrar cada
versão em prompts/CHANGELOG.md. O baseline recebe o mesmo número de rodadas de
ajuste que o revisor.
```

## M6. Fila de aprovação

```
Objetivo: interface local mínima para aprovar, editar ou rejeitar fatos e alertas.

Faça:
1. Servidor Node local pequeno (sem framework pesado se der) e uma página
   simples. Sem build complicado.
2. A página lista, para um texto analisado: os fatos candidatos extraídos e os
   alertas (com as duas citações lado a lado). Para cada item: aceitar, editar
   ou rejeitar.
3. Aceitar um fato escreve esse fato no frontmatter da ficha correta (criando a
   ficha se a entidade for nova) e faz um git commit com mensagem que diz de
   qual texto e qual item veio. Rejeitar só registra a decisão.
4. O cânone só muda por esse caminho (princípio 1 do CLAUDE.md). Garanta por
   teste que nenhuma outra parte do código escreve nas fichas aprovadas.
5. Testes: aceitar gera o commit e a ficha correta; rejeitar não altera
   fichas; editar grava o valor editado.

Critério de aceite (definição de pronto do M6): aprovar um fato gera um commit na
ficha.

Não faça: contas de usuário, autenticação, banco novo, hospedagem. É uma
ferramenta local.
```

## M7. Experimento comparativo

```
Objetivo: a tabela que responde à pergunta de pesquisa.

Faça:
1. Comando npm run experimento que roda três configurações nos 5 textos, com o
   mesmo modelo e o mesmo dataset: (a) só LLM (baseline), (b) só checagens em
   código, (c) combinado (checagens + revisor sobre os fatos extraídos).
2. Repetir cada execução N vezes (N configurável, mínimo 3) e reportar média e
   variação, porque modelo local não é determinístico.
3. Saída em tabela markdown pronta para colar no README: precisão, cobertura,
   falsos positivos, por configuração.

Critério de aceite (definição de pronto do M7): tabela com as três configurações e a variação entre execuções.

Seja honesto no texto que acompanha os números: dataset pequeno, modelo
específico, limites do que dá para concluir.
```

## M8. Timeline e README final

```
Objetivo: fechar o projeto para portfólio.

Faça:
1. Timeline interativa dos eventos do canon-demo, como página local simples.
   É só uma visão dos dados que já existem.
2. README principal em inglês e português: o problema, a pergunta de pesquisa,
   arquitetura (com diagrama), como rodar do zero sem pagar nada, a tabela do
   M7, limitações honestas e o que ficou para a v2.
3. Revisar docs/DECISOES.md para ficar legível para quem não viu o projeto.
4. Roteiro de um vídeo de demonstração de 2 a 3 minutos (só o roteiro).

Critério de aceite (definição de pronto do M8): alguém que nunca viu o projeto clona o repositório, segue o README e
consegue rodar a demonstração com o Ollama, sem nenhuma conta ou pagamento.
```
