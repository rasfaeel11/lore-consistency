# Changelog

As mudanças de cada versão. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e os números seguem o [versionamento semântico](https://semver.org/lang/pt-BR/). Enquanto a versão começar com 0, o formato dos arquivos e os comandos ainda podem mudar entre versões menores.

## [0.1.0] - 2026-10-06

Primeira versão.

### Adicionado
- `init`: cria a pasta da história a partir dos modelos (bíblia, estado, alfabeto, fichas, referências, prompts de sessão) e grava as instruções para a IA (`CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`) e o `lore-pack.config.json`.
- `check`: valida fichas, referências, capítulos e sessões, com mensagens que dizem o arquivo, o campo e como consertar.
- `pack`: monta o pacote de contexto da sessão (bíblia, estado, fichas citadas no plano e na última cena, referências por palavra-chave, última cena), com estimativa de tokens.
- `capitulo novo` e `sessao nova | listar | fechar | verificar`: capítulos em `capitulos/cap-NN.md` e uma pasta por sessão em `sessoes/<id>/`.
- Fichas de seis tipos (`personagem`, `lugar`, `faccao`, `objeto`, `povo`, `conceito`) e referências por tema, com palavras-chave.
- Guarda do cânone: snapshot dos arquivos protegidos ao criar a sessão, com `sessao verificar` para ver, reverter ou manter o que mudou.
- `apply`: lê o bloco `lore-pack-mudancas` do fechamento da sessão, mostra o diff de cada operação e grava só as escolhidas com `--aplicar`. Registra o que foi aplicado em `aplicado.json`.
- `ui`: app local no navegador (só `127.0.0.1`, com token por execução), com barra lateral de capítulos e sessões, nova sessão, copiar pacote, guarda, fechamento e apagar sessão.
- Terminal embutido no app (`node-pty` opcional), com o comando configurável em `lore-pack.config.json`.
- `atualizar-instrucoes`: atualiza as instruções para a IA de uma pasta já criada.
- Exemplo `exemplos/varmonte` (no repositório, fora do pacote do npm).
