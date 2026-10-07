import { z } from "zod";
import { idField, nomeField, optionalTextList } from "./ficha.js";

// Referência: cânone organizado por tema (magia, combate, política...), em referencias/<id>.md.
export const referenciaSchema = z.object({
  id: idField,
  // Opcional (as referências antigas não têm). Se vier, só pode ser "referencia".
  tipo: z.literal("referencia", { error: 'O "tipo" de uma referência é sempre "referencia". Escreva "tipo: referencia" ou tire a linha.' }).optional(),
  nome: nomeField,
  palavras_chave: optionalTextList("palavras_chave"),
});

export type Referencia = z.infer<typeof referenciaSchema>;
