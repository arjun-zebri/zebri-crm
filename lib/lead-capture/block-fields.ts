/**
 * Pure helpers bridging the Website form block tree to the lead-capture submit
 * payload. The `lead` surface's `formField` blocks define the fields; their
 * `role` decides how each answer maps into the fixed submit shape (canonical
 * couple columns) or the `custom` bag (notes-only). No React or transport here.
 *
 * @module lib/lead-capture/block-fields
 */
// The block type definitions live under app/(dashboard)/branding/ because they
// are consumed primarily by the editor surface there. This module is the
// accepted bridge that pulls the lead block shapes into a lib-level helper for
// the public form + submit route. Layering exception, mirroring lib/branding/
// readiness.ts and use-current-branding.ts.
// eslint-disable-next-line no-restricted-imports
import type { Block, FormFieldBlock } from '@/app/(dashboard)/branding/blocks/types'

/** The canonical (non-custom) submit keys a field role maps to. */
const ROLE_TO_KEY: Partial<Record<FormFieldBlock['role'], string>> = {
  name: 'name',
  partnerName: 'partner_name',
  email: 'email',
  phone: 'phone',
  weddingDate: 'wedding_date',
  venue: 'venue',
  message: 'message',
  referral: 'referral_source',
}

/** The `formField` blocks of a lead block tree, in document order. */
export function leadFieldBlocks(blocks: Block[]): FormFieldBlock[] {
  return blocks.filter((b): b is FormFieldBlock => b.type === 'formField')
}

/** Ids of the required `formField` blocks, for client-side validation. */
export function requiredFieldIds(blocks: Block[]): string[] {
  return leadFieldBlocks(blocks)
    .filter((b) => b.required)
    .map((b) => b.id)
}

/** The submit payload built from a lead block tree and its per-field values. */
export interface LeadPayload {
  name: string
  partner_name: string
  email: string
  phone: string
  wedding_date: string
  venue: string
  referral_source: string
  message: string
  custom: Array<{ label: string; value: string }>
}

/**
 * Map the MC's `formField` blocks + the visitor's answers (keyed by block id)
 * into the submit payload. Known roles fill their canonical key; `custom` fields
 * (and any field whose role has no canonical key) go into the `custom` bag using
 * the field label. Later duplicate roles win, matching last-wins form semantics.
 *
 * @param blocks - The `lead` surface block tree.
 * @param values - Answers keyed by `formField` block id.
 */
export function buildLeadPayload(blocks: Block[], values: Record<string, string>): LeadPayload {
  const payload: LeadPayload = {
    name: '',
    partner_name: '',
    email: '',
    phone: '',
    wedding_date: '',
    venue: '',
    referral_source: '',
    message: '',
    custom: [],
  }

  for (const field of leadFieldBlocks(blocks)) {
    const value = (values[field.id] ?? '').trim()
    if (value === '') continue
    const key = ROLE_TO_KEY[field.role]
    if (key) {
      payload[key as keyof Omit<LeadPayload, 'custom'>] = value
    } else {
      // role === 'custom' (or an unmapped role): keep the answer under its label.
      payload.custom.push({ label: field.label, value })
    }
  }

  return payload
}
