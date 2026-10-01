import { findMentions, type Nameable } from "./mentions.js";

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
};

export type SelectResult =
  | { ok: true; selected: SelectedFicha[] }
  | { ok: false; errors: string[] };

// Decide quais fichas entram no pacote e por quê.
export function selectFichas(input: SelectInput): SelectResult {
  const knownIds = new Set(input.fichas.map((f) => f.id));
  const errors = [
    ...unknownIds(input.include, knownIds, "--com"),
    ...unknownIds(input.exclude, knownIds, "--sem"),
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

function unknownIds(ids: string[], knownIds: Set<string>, option: string): string[] {
  return ids
    .filter((id) => !knownIds.has(id))
    .map(
      (id) =>
        `${option}: não existe ficha com id "${id}". O id é o nome do arquivo da ficha, sem o .md.`,
    );
}
