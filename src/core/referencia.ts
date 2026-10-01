import { z } from "zod";
import { idField, nomeField, optionalTextList } from "./ficha.js";

// Referência: cânone organizado por tema (magia, combate, política...), em referencias/<id>.md.
export const referenciaSchema = z.object({
  id: idField,
  nome: nomeField,
  palavras_chave: optionalTextList("palavras_chave"),
});

export type Referencia = z.infer<typeof referenciaSchema>;
