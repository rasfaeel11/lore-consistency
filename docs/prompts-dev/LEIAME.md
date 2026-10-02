# Todos os prompts (índice)

## Qual usar agora
O projeto ativo é o lore-pack. Use a pasta 1-lore-pack.

## 1-lore-pack (ATIVO)

### dev/ — prompts para CONSTRUIR o lore-pack (você cola no Claude Code)
Ordem de uso, um marco por sessão, sempre começando pela ABERTURA.md:

| Arquivo | O que faz |
|---|---|
| ABERTURA.md | Primeira mensagem de TODA sessão |
| M0.md | Esqueleto do projeto |
| M1.md | Comandos init e check |
| M2.md | Comando pack |
| M3.md | Capítulos e sessões (começa atualizando o CLAUDE.md) |
| M4a.md | App local: servidor, barra lateral, nova sessão |
| M4a1.md | Referências temáticas, tipos povo e conceito, regra de segredos |
| M4b.md | Corrige o ui, instruções da IA na pasta, terminal embutido, guarda do cânone |
| M5.md | apply: aplicar o fechamento da sessão com aprovação |
| M6.md | Publicação |
| EXTRAS-TERMINAIS.md | Prompts avulsos: executor, planejador, correção do ui |

Observação: M4a1 deve rodar antes do M4b. O M5 e o M6 foram escritos sem ver o código real; antes de usá-los, rode o prompt planejador do EXTRAS para ajustá-los ao repositório.

### sessao-de-escrita/ — prompts para ESCREVER a história (você cola numa IA)
Estes são os modelos que o comando init copia para a pasta da história. Depois do M2 e do M4a.1, o 00-abrir-sessao.md do repositório usa marcadores {{...}} preenchidos pelo pack; a cópia do SEU repositório é a que vale. Esta pasta tem a versão original.

00 abrir sessão · 01 planejar capítulo · 02 escrever cena · 03 revisar consistência · 04 fechar sessão · 05 nova ficha · 06 criar nomes · 07 compactar · 08 discutir rumos (e preparar fichas de quem vai aparecer)

## 2-fluxo-manual-original
O fluxo manual (antes do lore-pack existir): os mesmos 8 prompts de sessão com "[COLE AQUI]" e o COMO-USAR.md. Serve só como referência.

## 3-lore-checker-arquivado (NÃO é mais o projeto ativo)
O primeiro projeto (detector de inconsistências com pergunta de pesquisa): prompts do pipeline (extract, review, baseline-review, README dos prompts) e os prompts de marco M0 a M8 em PROMPTS-CLAUDE-CODE.md. Fica arquivado; o mundo de demonstração dele (Varmonte) está na pasta lore-checker/canon-demo, que NÃO está neste zip.

## O que NÃO está neste zip
- Os arquivos do mundo de demonstração Varmonte, o cânone de Eälen (ealen-lorepack.zip) e o CLAUDE.md do lore-pack: são dados e configuração, não prompts.
- Os prompts avulsos de conversa que não viraram arquivo além dos listados em EXTRAS-TERMINAIS.md.
