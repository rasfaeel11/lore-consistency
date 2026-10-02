# Prompts

Os prompts do projeto ficam aqui, versionados como código. Cada arquivo tem:

- **Frontmatter** com nome, versão, propósito, entradas e saída.
- **Variáveis** no formato `{{nome}}`, substituídas pelo código antes de chamar o modelo.
- **Schema de saída** em JSON, espelhado por um schema Zod em `src/`.
- **Validação em código**, que é o que torna a saída do modelo confiável.
- O texto do prompt entre os marcadores `<!-- PROMPT START -->` e `<!-- PROMPT END -->`. O carregador usa só o que está entre eles.

## Arquivos

| Arquivo | Usado em | Papel |
|---|---|---|
| `extract.md` | M4 | Transforma um trecho em fatos estruturados com citação literal |
| `review.md` | M5 | Compara fatos novos com a fatia do cânone e aponta conflitos |
| `baseline-review.md` | M7 | Baseline "só LLM" para o experimento comparativo |

## Regras de versionamento

1. Mudou o texto, o schema ou os exemplos: sobe a versão no frontmatter (`0.1.0` -> `0.2.0`).
2. Antes de manter a mudança, rode `npm run eval` no mundo de demo e registre o resultado em `CHANGELOG.md` (formato abaixo). Sem número, sem mudança.
3. Mudou o formato de saída: atualize o schema Zod na mesma alteração.
4. Um prompt, uma mudança por vez. Se mudar duas coisas, não dá pra saber qual ajudou.

## Formato do `CHANGELOG.md`

Crie o arquivo quando a primeira avaliação rodar.

| Data | Prompt | Versão | Modelo | O que mudou | Precisão | Cobertura | Falsos positivos |
|---|---|---|---|---|---|---|---|

## Validação de saída (resumo)

- **Extrator:** JSON válido; `citacao` é trecho literal do texto; `entidade_id` existe na lista ou é `null`. Falhou: uma nova tentativa, depois descarta o fato e registra no log.
- **Revisor e baseline:** JSON válido; ids existem; cada citação é trecho literal da origem correspondente. Alerta que falha qualquer checagem é descartado.

## Decisões de projeto dos prompts

- **Citação literal obrigatória** nos dois lados. É a defesa principal contra alarme falso e contra o modelo inventar fatos, e o código consegue verificar mecanicamente.
- **"Na dúvida, não reporte"** e "ausência não é contradição": modelo pequeno tende a inventar conflito, então o prompt empurra para o lado conservador.
- **Exemplos antes dos dados reais** e com aviso de que são só ilustração, pra o modelo não copiar os fatos do exemplo.
- **Exemplos do mundo de demo (Varmonte).** Nunca a lore real.
- **Instruções em português.** Modelos pequenos costumam seguir instruções em inglês um pouco melhor, mas o conteúdo é em português. Isso vira um experimento barato (ver abaixo).

## Limitações conhecidas

- Aritmética de datas e idades é frágil em modelo de 7-9B. O exemplo de "sem conflito" do revisor mostra o comportamento esperado, mas o trabalho confiável é das checagens em `src/checks/`.
- Os prompts são um ponto de partida. A primeira rodada de avaliação no modelo local vai mostrar onde falham, e o ajuste vem dos números, não de intuição.
- Saída em JSON puro pode falhar em modelos pequenos. Se o Ollama oferecer saída estruturada por schema na versão usada, vale ligar; confirmar na documentação atual antes de depender disso.

## Experimentos sugeridos (bons pro README final)

1. **Português vs. inglês nas instruções:** mesma tarefa, mesmo modelo, duas versões do prompt.
2. **Com e sem exemplos (few-shot):** quanto os exemplos melhoram a extração?
3. **Número de exemplos:** 1, 2 ou 3?
4. **Comparação de modelos locais** de 7-9B no mesmo conjunto de textos (escolha do modelo no M4).
5. **Pipeline completo vs. baseline** (o experimento central do M7).
