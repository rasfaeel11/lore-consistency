import { z } from "zod";

export const TIPOS = ["personagem", "lugar", "faccao", "objeto"] as const;
export type Tipo = (typeof TIPOS)[number];

// Pasta esperada dentro de fichas/ para cada tipo.
export const FOLDER_BY_TIPO: Record<Tipo, string> = {
  personagem: "personagens",
  lugar: "lugares",
  faccao: "faccoes",
  objeto: "objetos",
};

// Letras minúsculas sem acento e números, em blocos separados por um hífen.
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function missing(field: string): string {
  return `Campo obrigatório "${field}" ausente. Adicione a linha "${field}: ..." no cabeçalho.`;
}

// Campo opcional que é lista de textos. Ausente ou vazio ("aliases:") vira [].
function optionalTextList(field: string) {
  return z
    .array(z.string({ error: `Cada item de "${field}" precisa ser um texto.` }), {
      error: `"${field}" precisa ser uma lista de textos, por exemplo: ${field}: [um, outro]`,
    })
    .nullish()
    .transform((value) => value ?? []);
}

export const fichaSchema = z.object({
  id: z
    .string({
      error: (issue) => (issue.input === undefined ? missing("id") : '"id" precisa ser um texto.'),
    })
    .regex(ID_PATTERN, {
      error: (issue) =>
        `O id "${String(issue.input)}" é inválido. Use só letras minúsculas sem acento, números e hífen, por exemplo: ana-ferreira.`,
    }),
  tipo: z.enum(TIPOS, {
    error: (issue) =>
      issue.input === undefined
        ? missing("tipo")
        : `O tipo "${String(issue.input)}" não existe. Use um de: ${TIPOS.join(", ")}.`,
  }),
  nome: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? missing("nome")
          : issue.input === null
            ? '"nome" está vazio. Escreva o nome depois de "nome:".'
            : '"nome" precisa ser um texto.',
    })
    .trim()
    .min(1, { error: '"nome" está vazio. Escreva o nome depois de "nome:".' }),
  aliases: optionalTextList("aliases"),
  status: z
    .string({ error: '"status" precisa ser um texto, por exemplo: status: vivo' })
    .nullish()
    .transform((value) => value ?? undefined),
  aparece_em: optionalTextList("aparece_em"),
});

export type Ficha = z.infer<typeof fichaSchema>;
