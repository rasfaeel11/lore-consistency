// Pedido de correção dos problemas do check: o autor clica em "Resolver com a IA" e uma
// conversa nova recebe este texto. Puro: recebe o relatório do check, devolve o pedido.

// Dono do terminal e nome do snapshot da correção. Não é um id de sessão válido
// (falta a data e o capítulo), então nunca se confunde com uma sessão de escrita.
export const FIX_ID = "correcao";

// Onde o app grava o pedido. Fica em .lore-pack/, fora do git e fora do check.
export const FIX_FILE = ".lore-pack/correcao.md";

// Uma linha só e sem aspas, como o buildStartPrompt: vai como argumento do comando que abre a IA.
export const FIX_START_PROMPT = `Leia o arquivo ${FIX_FILE} e siga as instruções dele.`;

export function buildFixRequest(report: string): string {
  return `# Pedido: corrigir os problemas do check

O \`lore-pack check\` achou os problemas listados no fim deste arquivo. O autor pediu que você corrija
todos os que der para corrigir **sem inventar nada**. Para isso, pode editar direto os arquivos citados.

## Como corrigir

1. Leia o \`CLAUDE.md\` (formato da ficha e da referência). Antes de mexer num arquivo, leia ele inteiro.
2. Mude só o necessário para o problema sumir. Não reescreva, não resuma e não apague texto que não
   faz parte do problema.
3. **Problema de forma, você resolve sozinho:** cabeçalho inválido, campo que falta, id diferente do
   nome do arquivo, ficha na pasta errada, seções fora de ordem, link com o id digitado errado
   (quando existe uma ficha que é claramente a certa).
4. **Problema que depende de uma decisão da história, você não resolve.** Não invente fato, nome,
   ficha nem segredo. Exemplos: um id citado que não tem ficha e sobre o qual os arquivos não dizem
   nada; um nome ou alias repetido em duas fichas; um segredo que precisa mudar de lugar. Deixe como
   está e liste em "Ficou para o autor".
5. Não mude o texto dos capítulos nem o plano das sessões. Neles, só o que o check pedir (nome do
   arquivo, cabeçalho). Não mexa no \`CLAUDE.md\`, no \`AGENTS.md\` nem no \`lore-pack.config.json\`.
6. Se renomear ou mover um arquivo, procure quem cita o id antigo e ajuste junto.
7. Ao terminar, rode \`lore-pack check\` (se o comando existir no terminal) e corrija o que ainda
   aparecer. Se um problema voltar depois de duas tentativas, pare e liste em "Ficou para o autor".
8. Termine com um resumo em duas listas: **Corrigido** (arquivo: o que mudou) e **Ficou para o
   autor** (problema: o que ele precisa decidir).

O lore-pack guardou uma cópia dos arquivos antes de você começar. O autor vai ver o diff de tudo o
que você mudar e pode desfazer.

## Problemas

\`\`\`
${report.trimEnd()}
\`\`\`
`;
}
