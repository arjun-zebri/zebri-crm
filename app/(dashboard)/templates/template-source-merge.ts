/**
 * Pure rules for pulling a package into an invoice template's draft.
 *
 * A package and the template being edited can each be itemised or
 * single-price, so "Add from package" has four cases. The aim in every
 * case is that the template's total moves by exactly the package's base
 * price, and no line ends up showing a misleading $0:
 *
 * | package  | template             | result                                              |
 * |----------|----------------------|-----------------------------------------------------|
 * | single   | empty or single      | template goes single; inclusions appended; price added |
 * | single   | itemised with items  | ONE priced line (inclusions in its note)            |
 * | itemised | single               | descriptions appended as inclusions; base total added to the price |
 * | itemised | itemised             | priced lines appended as-is                          |
 *
 * @module app/(dashboard)/templates/template-source-merge
 */
import { packageTotals, roundCents, singlePriceLine, type PackagePricingMode } from '@/lib/payments/package-math'

import type { EditableItem } from './line-items-editor'

/** A package whose base items can be pulled into a template. */
export interface TemplateSource {
  id: string
  kind: 'package'
  name: string
  pricingMode: PackagePricingMode
  /** The whole base price when single; null when itemised. */
  fixedPrice: number | null
  /** Base (non-add-on) items, already flattened to line totals. */
  items: { description: string; note?: string | null; amount: number }[]
}

/** The slice of form state a merge reads and writes. */
export interface TemplatePricingDraft {
  items: EditableItem[]
  singlePrice: boolean
  /** Raw input text, as the price field holds it. */
  fixedPrice: string
}

const newId = () => `new-${crypto.randomUUID()}`

/** Add `amount` to a raw price string, keeping it a plain decimal. */
function addToPrice(raw: string, amount: number): string {
  const current = Number.parseFloat(raw)
  const sum = roundCents((Number.isFinite(current) ? current : 0) + amount)
  return String(sum)
}

/** Merge one package into the template draft (see the module table). */
export function mergeSourceIntoTemplate(draft: TemplatePricingDraft, source: TemplateSource): TemplatePricingDraft {
  const sourcePrice = packageTotals(source.items, {
    pricingMode: source.pricingMode,
    fixedPrice: source.fixedPrice,
  }).base
  const asInclusions = source.items.map((it) => ({
    id: newId(),
    description: it.description,
    note: it.note ?? null,
    amount: 0,
    quantity: 1,
  }))
  const templateEmpty = draft.items.every((i) => !i.description.trim() && !(Number(i.amount) || 0))

  if (source.pricingMode === 'single' && (draft.singlePrice || templateEmpty)) {
    return {
      items: [...draft.items.filter((i) => i.description.trim() || Number(i.amount)), ...asInclusions],
      singlePrice: true,
      fixedPrice: addToPrice(draft.singlePrice ? draft.fixedPrice : '', sourcePrice),
    }
  }

  if (source.pricingMode === 'single') {
    const line = singlePriceLine(source.name, source.items, source.fixedPrice)
    return { ...draft, items: [...draft.items, { id: newId(), ...line, quantity: 1 }] }
  }

  if (draft.singlePrice) {
    return {
      ...draft,
      items: [...draft.items, ...asInclusions],
      fixedPrice: addToPrice(draft.fixedPrice, sourcePrice),
    }
  }

  return {
    ...draft,
    items: [
      ...draft.items,
      ...source.items.map((it) => ({ id: newId(), description: it.description, note: it.note ?? null, amount: it.amount, quantity: 1 })),
    ],
  }
}
