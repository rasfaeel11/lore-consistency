# Diário de decisões

Cada entrada: data, decisão, motivo e alternativas consideradas.

## 2026-10-01: argumentos da CLI com `util.parseArgs`

Decisão: usar o `util.parseArgs` do próprio Node em vez de uma biblioteca de CLI.

Motivo: a CLI tem poucos comandos e opções simples. O `parseArgs` já vem no Node, então não acrescenta dependência nem manutenção. A ajuda é escrita à mão, em português.

Alternativas: commander e yargs geram a ajuda e tratam subcomandos sozinhos, mas são dependência extra e trazem mensagens em inglês. Reavaliar se os subcomandos ficarem complexos.

## 2026-10-01: `@types/node` como dependência de desenvolvimento

Decisão: instalar `@types/node`, além de TypeScript, Vitest e tsx.

Motivo: o TypeScript strict precisa dos tipos das APIs do Node (`node:fs`, `node:util`). São só tipos e não vão para o pacote publicado.
