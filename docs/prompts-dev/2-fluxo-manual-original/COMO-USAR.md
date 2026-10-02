# Como usar

Uma pasta, arquivos curtos, uma conversa nova por capítulo. O que não está nos arquivos não existe na próxima sessão.

## Estrutura

- `biblia.md`: sua bíblia (regras do mundo, tom, conflito central). Sempre vai no pacote.
- `alfabeto.md`: regras de nomes por povo + lista de nomes já usados. Só vai no pacote quando a sessão for criar nomes.
- `estado.md`: resumo geral, resumo por capítulo, setups abertos, decisões. Sempre vai no pacote.
- `fichas/`: uma ficha por personagem, lugar, facção ou objeto. Só as fichas da cena vão no pacote.
- `capitulos/`: o texto final de cada capítulo (`cap-01.md`, `cap-02.md`...). Só a última cena vai no pacote.
- `modelos/`: modelo de ficha.
- `prompts/`: os prompts, numerados na ordem de uso.

## O ritual de cada sessão

1. Conversa nova.
2. `00-abrir-sessao`: cola o pacote (bíblia + estado + fichas da cena + última cena).
3. `01-planejar-capitulo`: roteiro em batidas, sem prosa.
4. `02-escrever-cena`: uma cena por vez. Você corrige e aprova.
5. `03-revisar-consistencia` quando quiser checar uma cena contra o pacote.
6. `04-fechar-sessao`: gera só as mudanças nos arquivos. Você aplica e fecha a conversa.

Prompts de apoio, a qualquer momento: `05-nova-ficha`, `06-criar-nomes`, `07-compactar`.

## Regras pra economizar tokens

- Só as fichas dos personagens e lugares que aparecem na cena. Nunca todas.
- Só a última cena inteira, nunca o capítulo anterior completo.
- Fichas em estilo telegráfico. Use `07-compactar` se alguma ficha passar de umas 20 linhas, e também na bíblia, se ela for longa (guarde a versão completa e use a compacta no pacote).
- Conversa ficou longa (muitas cenas)? Roda o `04-fechar-sessao`, atualiza os arquivos e abre conversa nova.
- Peça sempre só o que mudou, nunca o arquivo reescrito.

## Quem decide o quê

Você decide a direção, o enredo e o destino dos personagens. A IA escreve detalhes, descrições, diálogos e foreshadowing e propõe coisas novas, mas nada vira cânone sem você aprovar no fechamento da sessão.
