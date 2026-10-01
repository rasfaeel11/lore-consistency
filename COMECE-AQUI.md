# Comece aqui

Este arquivo é só pra você. Pode apagar depois que o projeto estiver andando.

## O que é cada coisa

- **CLAUDE.md**: instruções que o Claude Code lê sozinho quando você abre ele nesta pasta. Você não cola em lugar nenhum.
- **templates/**: o que a ferramenta vai copiar para a pasta de história de quem usar (inclusive você). São os mesmos modelos e prompts de sessão do seu fluxo de escrita.
- **docs/prompts-dev/**: os ÚNICOS arquivos que você cola, no Claude Code, para construir o projeto. Por enquanto só existem ABERTURA, M0 e M1.

## Passo a passo

1. Extraia esta pasta onde quiser, por exemplo `Projetos/lore-pack`.
2. Abra o terminal dentro dela e rode `claude`.
3. Abra `docs/prompts-dev/ABERTURA.md`, copie o texto que vem depois de "Copie a partir daqui" e cole no Claude Code.
4. Depois cole o texto do `M0.md`.
5. Quando o M0 passar nos testes, faça um commit, feche o Claude Code, abra de novo e repita com ABERTURA + `M1.md`.
6. Terminou o M1? Me chama que fazemos o prompt do M2.

## Sua história

Ela NÃO entra nesta pasta. Quando o `init` existir (fim do M1), você roda ele numa pasta separada e privada, cola sua bíblia lá e começa a usar.
