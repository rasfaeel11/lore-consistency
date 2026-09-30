# Lore Consistency Checker

> Nome provisório. Ferramenta que ajuda quem escreve um mundo de fantasia a manter consistência: extrai fatos dos textos, compara com um cânone aprovado por humano e aponta contradições **com citação dos dois lados**.

## Pergunta de pesquisa

Extração estruturada + checagens determinísticas + revisão por LLM acha mais contradições, com menos alarmes falsos, do que só perguntar pro LLM "tem contradição aqui?". Se o resultado for "não", o trabalho continua válido: o objetivo é medir, não provar.

## Status atual

- Marco em andamento: **M1** (formato das fichas + leitor que gera o índice SQLite)
- Marcos: M1 fichas e índice · M2 mundo de demo com contradições plantadas · M3 checagens determinísticas · M4 extrator · M5 revisor com citação obrigatória · M6 fila de aprovação · M7 experimento comparativo · M8 timeline e README final
- Atualize esta seção ao fechar cada marco.

## Fora do escopo da v1 (não sugerir nem implementar)

Escritor de histórias automático, conlang, mapa, busca vetorial, contas de usuário, hospedagem online, app desktop. Ideia nova vai pra `docs/V2.md`, nunca pro código.

## Princípios (invariantes)

1. **O cânone só muda com aprovação humana.** Nenhum código escreve nas fichas aprovadas sem passar pela fila de aprovação.
2. **Todo alerta exige duas citações:** o trecho novo e o trecho do cânone que contradiz. Alerta sem as duas é descartado, não exibido.
3. **Toda saída de modelo é validada em código antes de ser usada:** JSON conforme o schema, e cada citação precisa ser um trecho **literal** do texto de origem. Falhou a validação: uma nova tentativa, depois descarta e registra no log.
4. **O núcleo não conhece provedor de IA.** Ele fala com uma interface (`extrair`, `revisar`); cada provedor é um adaptador. Nada no núcleo importa SDK de modelo.
5. **Nada pago é requisito.** O caminho padrão roda com modelo local (Ollama). Adaptadores de CLI (troca por arquivo) e de API são opcionais.
6. **Regra exata é código, não LLM.** O que dá pra checar de forma determinística (morto que reaparece, magia sem custo, datas e idades impossíveis) fica em `src/checks/`. O revisor LLM não é confiável pra aritmética de datas.
7. **Fichas são a fonte de verdade.** O índice SQLite é regenerável a partir delas e nunca é editado à mão.
8. **Lore real fora do repo.** Este repositório é público. Só o mundo de demonstração entra. Nunca commitar texto inédito real nem trechos com licença incompatível.

## Arquitetura

```
canon-demo/          # mundo de demonstração (fichas .md com YAML)
  entities/
  events/
  rules/
  texts/             # textos narrativos de teste (com contradições plantadas)
  eval/contradicoes.yaml   # gabarito das contradições plantadas
src/
  canon/             # leitor de fichas, validação de schema, geração do índice
  checks/            # checagens determinísticas
  providers/         # interface + adaptadores (ollama, file-exchange, api)
  extract/           # extrator: trecho -> fatos (JSON com schema fixo)
  review/            # revisor: fatos + fatia do cânone -> alertas com citação
  approval/          # fila de aprovação; aprovar gera commit na ficha
  eval/              # CLI de avaliação (precisão, cobertura)
prompts/             # prompts versionados (ver seção Prompts)
docs/
  DECISOES.md        # diário de decisões
  V2.md              # ideias adiadas
```

## Modelo de dados mínimo

- **Entidade:** id, tipo (personagem, lugar, facção, evento, regra), nome, atributos
- **Fato:** id, entidade, campo, valor, quando, afirmado_por, origem (arquivo + citação literal), status (`candidato` | `aprovado`)
- **Evento:** data, participantes, local, efeitos
- **Regra:** id, nome, descrição, checagem associada
- **Alerta:** fato novo, fato do cânone (ou regra), tipo, gravidade, citação nova, citação do cânone, decisão (`aceito` | `editado` | `rejeitado`)

## Stack e convenções

Padrões sugeridos pra não travar na decisão. Trocar só com registro em `docs/DECISOES.md`.

- TypeScript em modo `strict` + Node (versão LTS atual), npm.
- Testes: Vitest.
- Validação de schema: Zod.
- Índice local: SQLite via `better-sqlite3`.
- Leitura das fichas: parser de frontmatter YAML em markdown.
- Modelo local: Ollama. O modelo específico é escolhido no M4, comparando 2 ou 3 modelos de 7-9B com boa qualidade em português. Registrar o resultado em `docs/DECISOES.md`.
- Identificadores de código em inglês; documentação e comentários em português.
- Funções pequenas e puras onde der; efeitos colaterais (disco, git, modelo) isolados em módulos de borda.
- Todo módulo novo vem com testes. Checagens determinísticas são testadas contra o gabarito em `canon-demo/eval/`.

## Comandos (planejados)

- `npm install` · `npm test` · `npm run index` (regenera o índice) · `npm run eval` (mede precisão e cobertura)
- Atualize esta lista quando os scripts existirem de verdade.

## Prompts

- Ficam em `prompts/`, versionados como código. Formato e variáveis estão em `prompts/README.md`.
- O carregador extrai o texto do prompt entre os marcadores `<!-- PROMPT START -->` e `<!-- PROMPT END -->`.
- **Toda mudança de prompt sobe a versão e é medida contra o mundo de demo.** Sem número, sem mudança. Registrar o resultado em `prompts/CHANGELOG.md`.
- Mudou o formato de saída de um prompt: atualizar o schema Zod correspondente na mesma alteração.
- Os exemplos dentro dos prompts usam o **mundo de demonstração** (Varmonte). Nunca a lore real.
- O prompt de baseline (`baseline-review.md`) recebe o mesmo esforço de ajuste que o revisor principal, senão o experimento do M7 perde validade.

## Mundo de demonstração vs. lore real

- `canon-demo/` é um mundo pequeno, inventado pra este projeto, com contradições plantadas e gabarito. É o que o repositório público contém e o que a avaliação usa.
- A lore real do autor vive em **outro repositório, privado**, usando esta mesma ferramenta apontada pra outra pasta. Nada dela entra aqui, nem como exemplo em prompt ou teste.

## Como trabalhar comigo

Estou reaprendendo TypeScript depois de um tempo parado e quero aprender enquanto o projeto anda.

- **Padrão: implemente, em passos pequenos, e explique o porquê em linguagem simples.** Ao final de cada tarefa, termine com "Pra estudar": 2 ou 3 pontos que eu deveria entender do que foi feito.
- **Se eu disser "modo guiado":** não entregue pronto. Explique o caminho, me peça pra escrever e revise o que eu fizer.
- **Testes primeiro:** a partir da spec, escreva o teste, rode pra ver falhar, depois implemente. Explique o que o teste garante.
- **Código simples e idiomático.** Evite generics complicados e abstração antecipada. Comente o porquê de construções menos óbvias.
- **Plano curto antes de mudança grande,** e espere eu concordar. Mudança pequena e focada pode ir direto.
- **Diffs pequenos e revisáveis.** Sem reescrever arquivos inteiros à toa, sem refatoração não pedida no meio de outra tarefa.
- **Não amplie o escopo.** Se algo for útil mas estiver fora da v1, sugira registrar em `docs/V2.md`.
- **Seja direto e honesto.** Se uma decisão minha for ruim, diga e explique. Se não souber ou não tiver certeza, diga em vez de inventar.
- **Não invente APIs, flags ou comportamento de ferramentas.** Se depender de detalhe que pode ter mudado (Ollama, CLIs, libs), verifique na documentação ou me peça pra verificar.
- Registre decisões relevantes em `docs/DECISOES.md` (o que foi escolhido, por quê, o que foi descartado). Proponha a entrada; eu aprovo o texto.

## Definição de pronto (por marco)

| Marco | Pronto quando |
|---|---|
| M1 | Valida uma ficha malformada e acusa o erro |
| M2 | Pelo menos 20 contradições catalogadas, de tipos variados, com gabarito |
| M3 | Acha as contradições "exatas" do gabarito |
| M4 | Acurácia da extração medida em trechos com fatos conferidos à mão |
| M5 | Relatório de acertos e falsos positivos do revisor |
| M6 | Aprovar um fato gera commit na ficha |
| M7 | Tabela comparativa: só LLM vs. regras vs. combinado |
| M8 | Vídeo curto, decisões documentadas, limitações honestas no README |

## Riscos conhecidos

- Modelo local de 7-8B pode extrair mal em português: medir no M4 antes de construir em cima.
- Falso positivo do revisor: a citação literal obrigatória e a avaliação existem por isso.
- Escopo crescendo: qualquer ideia nova vai pra `docs/V2.md`.
- CLIs de terceiros mudam: comandos de cada provedor ficam como configuração editável, não fixos no código.
