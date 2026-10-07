import { z } from "zod";

export const TIPOS = ["personagem", "lugar", "faccao", "objeto", "povo", "conceito"] as const;
export type Tipo = (typeof TIPOS)[number];

// Pasta esperada dentro de fichas/ para cada tipo.
export const FOLDER_BY_TIPO: Record<Tipo, string> = {
  personagem: "personagens",
  lugar: "lugares",
  faccao: "faccoes",
  objeto: "objetos",
  povo: "povos",
  conceito: "conceitos",
};

// Letras minúsculas sem acento e números, em blocos separados por um hífen.
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function missing(field: string): string {
  return `Campo obrigatório "${field}" ausente. Adicione a linha "${field}: ..." no cabeçalho.`;
}

// Campo opcional que é lista de textos. Ausente ou vazio ("aliases:") vira [].
// As referências também usam.
export function optionalTextList(field: string) {
  return z
    .array(z.string({ error: `Cada item de "${field}" precisa ser um texto.` }), {
      error: `"${field}" precisa ser uma lista de textos, por exemplo: ${field}: [um, outro]`,
    })
    .nullish()
    .transform((value) => value ?? []);
}

// id e nome seguem a mesma regra nas fichas e nas referências.
export const idField = z
  .string({
    error: (issue) => (issue.input === undefined ? missing("id") : '"id" precisa ser um texto.'),
  })
  .regex(ID_PATTERN, {
    error: (issue) =>
      `O id "${String(issue.input)}" é inválido. Use só letras minúsculas sem acento, números e hífen, por exemplo: ana-ferreira.`,
  });

export const nomeField = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? missing("nome")
        : issue.input === null
          ? '"nome" está vazio. Escreva o nome depois de "nome:".'
          : '"nome" precisa ser um texto.',
  })
  .trim()
  .min(1, { error: '"nome" está vazio. Escreva o nome depois de "nome:".' });

export const fichaSchema = z.object({
  id: idField,
  tipo: z.enum(TIPOS, {
    error: (issue) =>
      issue.input === undefined
        ? missing("tipo")
        : `O tipo "${String(issue.input)}" não existe. Use um de: ${TIPOS.join(", ")}.`,
  }),
  nome: nomeField,
  aliases: optionalTextList("aliases"),
  // Ids de outras fichas ou referências. O check confere se cada um existe.
  relacionados: optionalTextList("relacionados"),
  status: z
    .string({ error: '"status" precisa ser um texto, por exemplo: status: vivo' })
    .nullish()
    .transform((value) => value ?? undefined),
  aparece_em: optionalTextList("aparece_em"),
});

export type Ficha = z.infer<typeof fichaSchema>;

// Seções do corpo da ficha, na ordem do modelo. "Segredo do autor" é opcional.
export const FICHA_SECTIONS = ["Detalhes", "Relações", "Segredo do autor", "Na história"];
