# Como usar

Uma pasta, arquivos curtos, uma conversa nova por capítulo. O que não está nos arquivos não existe na próxima sessão.

## Estrutura

- `biblia.md`: sua bíblia (regras do mundo, tom, conflito central). Sempre vai no pacote.
- `alfabeto.md`: regras de nomes por povo + lista de nomes já usados. Só vai no pacote quando a sessão for criar nomes.
- `estado.md`: resumo geral, resumo por capítulo, setups abertos, decisões. Sempre vai no pacote.
- `fichas/`: uma ficha por personagem, lugar, facção ou objeto. Só as fichas da cena vão no pacote.
- `capitulos/`: o texto final de cada capítulo (`cap-01.md`, `cap-02.md`...). Só a última cena vai no pacote. Crie com `lore-pack capitulo novo "título"`.
- `sessoes/`: uma pasta por sessão de escrita, com o plano (`sessao.md`), o pacote (`pacote.md`) e o fechamento. Crie com `lore-pack sessao nova`, veja com `lore-pack sessao listar` e feche com `lore-pack sessao fechar`.
- Guarda do cânone: quando a sessão é criada, o lore-pack guarda uma cópia da bíblia, do estado, do alfabeto, das fichas, das referências e dos capítulos (em `.lore-pack/`). Se a IA mexer direto nesses arquivos, `lore-pack sessao verificar <id>` (ou o botão "Verificar alterações" no app) mostra o que mudou, e você escolhe reverter ou manter. Ela avisa depois que aconteceu; não impede a IA de escrever.
- `modelos/`: modelo de ficha.

Prefere janela a terminal? Rode `lore-pack ui` na pasta da história e abra o endereço que ele mostrar: capítulos e sessões na barra lateral, botão de nova sessão e de copiar o pacote. Só funciona no seu computador.
- `prompts-de-sessao/`: os prompts que você cola na IA, numerados na ordem de uso.

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
