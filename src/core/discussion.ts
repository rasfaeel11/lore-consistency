// Conversa com a IA fora de sessão: livre (sem pedido) ou para discutir os rumos da história.
// Puro: recebe os arquivos da história já lidos e devolve o texto do pedido.

import { isFichaPath, isReferenciaPath, type StoryFile } from "./validate.js";

// Dono dos terminais e nome do snapshot da conversa. Não é um id de sessão válido
// (falta a data e o capítulo), então nunca se confunde com uma sessão de escrita.
export const TALK_ID = "conversa";

// Onde o app grava o pedido da discussão. Fica em .lore-pack/, fora do git e fora do check.
export const DISCUSSION_FILE = ".lore-pack/discussao.md";

// Uma linha só e sem aspas, como o buildStartPrompt: vai como argumento do comando que abre a IA.
export const DISCUSSION_START_PROMPT = `Leia o arquivo ${DISCUSSION_FILE} e siga as instruções dele.`;

// Na discussão entra tudo: quem decide o rumo de um personagem precisa ver o elenco inteiro.
export function discussionFiles(files: StoryFile[]): { fichas: StoryFile[]; referencias: StoryFile[] } {
  return {
    fichas: files.filter((file) => isFichaPath(file.path)),
    referencias: files.filter((file) => isReferenciaPath(file.path)),
  };
}

const ROLE = `O autor quer discutir os próximos rumos da história com você antes de planejar o capítulo.
Seu papel: ele decide, você opina. Diga com que concorda, com que discorda e por quê, usando só o
que está no cânone. Pode discordar abertamente se achar uma ideia fraca, contraditória com o
cânone ou que desperdiça um setup aberto.`;

const STEPS = `1. **Discussão.** Responda em no máximo 15 linhas:
   - Setups abertos no estado que combinam com a decisão.
   - Sua opinião sobre 2 ou 3 caminhos possíveis, com o custo e o ganho de cada um para a história.
   - Qualquer contradição entre o que o autor propõe e a bíblia, o estado ou as fichas.
   Espere a decisão do autor antes de seguir para a etapa 2.
2. **Fichas de quem vai aparecer.** Depois da decisão, liste os personagens, lugares, facções,
   objetos, povos ou conceitos que ainda não têm ficha e vão aparecer por causa dela. Para cada
   um, proponha a ficha completa no modelo, em estilo telegráfico (frases curtas, só fatos):
   - Use só o que ficou decidido na etapa 1 e o que já está no cânone.
   - Linha que você completou sem o autor ter dito: marque com [PROPOSTA], para ele aprovar.
   - Se a entidade já tem ficha, não repita: diga só que ela participa e o que mudaria nela.`;

// Pedido para a IA que roda no terminal, dentro da pasta: ela lê os arquivos, então vai só a lista.
export function buildDiscussionRequest(topic: string, files: StoryFile[]): string {
  const { fichas, referencias } = discussionFiles(files);
  const list = (items: StoryFile[]) => items.map((file) => `- \`${file.path}\``).join("\n");
  const fichasBlock =
    fichas.length > 0 ? `Todas as fichas (${fichas.length}):\n${list(fichas)}` : "Ainda não há fichas nesta história.";
  const refsBlock = referencias.length > 0 ? `\n\nTodas as referências (${referencias.length}):\n${list(referencias)}` : "";

  return `# Pedido: discutir os rumos da história

${ROLE}

## O que o autor quer decidir

${topic.trim()}

## Antes de responder, leia

- \`biblia.md\` e \`estado.md\`, inteiros.
- \`modelos/ficha-modelo.md\`, para a etapa 2.
- Se a decisão envolver nomes novos, \`alfabeto.md\`. Se precisar do texto de uma cena, \`capitulos/\`.

${fichasBlock}${refsBlock}

## Como discutir

${STEPS}

## Regras

- Não edite nenhum arquivo sem o autor pedir. Nada vira cânone sem a aprovação dele.
- Se ele pedir para gravar uma ficha ou mudar um arquivo, pode gravar direto. O lore-pack guardou
  uma cópia dos arquivos antes de você começar: o autor vê o diff de tudo e pode desfazer.
`;
}

// O mesmo pedido para colar numa IA que não enxerga a pasta: o texto de tudo vai junto.
export function buildDiscussionPack(topic: string, files: StoryFile[], model: string | undefined): string {
  const { fichas, referencias } = discussionFiles(files);
  const content = (path: string) => files.find((file) => file.path === path)?.content.trim() ?? "";
  const join = (items: StoryFile[]) => items.map((file) => file.content.trim()).join("\n\n");

  const blocks = [
    `=== BÍBLIA ===\n${content("biblia.md")}`,
    `=== ESTADO ===\n${content("estado.md")}`,
    `=== TODAS AS FICHAS (${fichas.length}) ===\n${join(fichas) || "Ainda não há fichas."}`,
  ];
  if (referencias.length > 0) blocks.push(`=== TODAS AS REFERÊNCIAS (${referencias.length}) ===\n${join(referencias)}`);
  if (model) blocks.push(`=== MODELO DE FICHA ===\n${model.trim()}`);

  // Mesmo texto do pedido do terminal ("o autor" é quem cola), para as duas IAs receberem as mesmas regras.
  return `${ROLE}

O que o autor quer decidir: ${topic.trim()}

Faça, em duas etapas:

${STEPS}

Nada aqui vira cânone sem a aprovação do autor.

${blocks.join("\n\n")}
`;
}
