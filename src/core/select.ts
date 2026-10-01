import { findMentions, findTerms, type Nameable } from "./mentions.js";

export type Reason = "plano" | "última cena" | "forçada";

export type SelectedFicha = {
  id: string;
  reasons: Reason[];
  // Nomes/aliases que casaram no plano ou na última cena (vazio se só foi forçada).
  matched: string[];
};

export type SelectInput = {
  fichas: Nameable[];
  plan: string;
  lastScene: string;
  include: string[]; // ids de --com
  exclude: string[]; // ids de --sem
  // Ids das referências: o --sem também vale para elas, então não são "id inexistente".
  referenciaIds?: string[];
};

export type SelectResult =
  | { ok: true; selected: SelectedFicha[] }
  | { ok: false; errors: string[] };

// Decide quais fichas entram no pacote e por quê.
export function selectFichas(input: SelectInput): SelectResult {
  const knownIds = new Set(input.fichas.map((f) => f.id));
  const refIds = input.referenciaIds ?? [];
  const errors = [
    ...unknownIds(input.include, knownIds, "--com"),
    ...input.exclude
      .filter((id) => !knownIds.has(id) && !refIds.includes(id))
      .map(
        (id) =>
          `--sem: não existe ficha nem referência com id "${id}". O id é o nome do arquivo, sem o .md.`,
      ),
  ];
  if (errors.length > 0) return { ok: false, errors };

  const inPlan = findMentions(input.plan, input.fichas);
  const inScene = findMentions(input.lastScene, input.fichas);

  const selected: SelectedFicha[] = [];
  // Percorre na ordem das fichas para o resultado ser sempre o mesmo.
  for (const ficha of input.fichas) {
    if (input.exclude.includes(ficha.id)) continue;

    const planMention = inPlan.find((m) => m.id === ficha.id);
    const sceneMention = inScene.find((m) => m.id === ficha.id);
    const reasons: Reason[] = [];
    if (planMention) reasons.push("plano");
    if (sceneMention) reasons.push("última cena");
    if (input.include.includes(ficha.id)) reasons.push("forçada");
    if (reasons.length === 0) continue;

    const matched = [...new Set([...(planMention?.matched ?? []), ...(sceneMention?.matched ?? [])])];
    selected.push({ id: ficha.id, reasons, matched });
  }
  return { ok: true, selected };
}

export type ReferenciaReason = "plano" | "forçada";

export type SelectedReferencia = {
  id: string;
  reasons: ReferenciaReason[];
  // Palavras-chave que casaram no plano (vazio se só foi forçada).
  matched: string[];
};

export type SelectReferenciasInput = {
  referencias: { id: string; palavras_chave: string[] }[];
  plan: string;
  include: string[]; // ids de --ref
  // Ids de --sem. Os que não são referência são ignorados aqui: o selectFichas confere.
  exclude: string[];
};

export type SelectReferenciasResult =
  | { ok: true; selected: SelectedReferencia[] }
  | { ok: false; errors: string[] };

// Decide quais referências entram no pacote. Só o plano e o --ref puxam referências:
// a última cena não, para elas não irem se acumulando de sessão em sessão.
export function selectReferencias(input: SelectReferenciasInput): SelectReferenciasResult {
  const knownIds = new Set(input.referencias.map((r) => r.id));
  const errors = input.include
    .filter((id) => !knownIds.has(id))
    .map((id) => `--ref: não existe referência com id "${id}". O id é o nome do arquivo em referencias/, sem o .md.`);
  if (errors.length > 0) return { ok: false, errors };

  const inPlan = findTerms(
    input.plan,
    input.referencias.map((r) => ({ id: r.id, terms: r.palavras_chave })),
  );

  const selected: SelectedReferencia[] = [];
  for (const referencia of input.referencias) {
    if (input.exclude.includes(referencia.id)) continue;
    const planMention = inPlan.find((m) => m.id === referencia.id);
    const reasons: ReferenciaReason[] = [];
    if (planMention) reasons.push("plano");
    if (input.include.includes(referencia.id)) reasons.push("forçada");
    if (reasons.length === 0) continue;
    selected.push({ id: referencia.id, reasons, matched: planMention?.matched ?? [] });
  }
  return { ok: true, selected };
}

function unknownIds(ids: string[], knownIds: Set<string>, option: string): string[] {
  return ids
    .filter((id) => !knownIds.has(id))
    .map(
      (id) =>
        `${option}: não existe ficha com id "${id}". O id é o nome do arquivo da ficha, sem o .md.`,
    );
}
