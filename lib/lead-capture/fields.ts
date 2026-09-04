/**
 * The public description of a lead form's fields, and the server-side
 * required-field check that uses it. One function derives the field list for
 * both `GET /api/lead/config` (what a third party reads) and the submit route
 * (what the server enforces), so the two cannot drift.
 *
 * @module lib/lead-capture/fields
 */
// Same layering exception as block-fields.ts: the block types live under the
// branding editor because that is their primary consumer.
// eslint-disable-next-line no-restricted-imports
import type { Block, FormFieldInputType, FormFieldRole } from '@/app/(dashboard)/branding/blocks/types'

import { type LeadPayloadKey, leadFieldBlocks, payloadKeyForRole } from './block-fields'

/** One field as exposed by the public config endpoint. Nothing else leaks. */
export interface PublicLeadField {
  id: string
  /** Payload key the answer goes under, or `custom` for `{ label, value }` in `custom[]`. */
  key: LeadPayloadKey | 'custom'
  role: FormFieldRole
  label: string
  required: boolean
  inputType: FormFieldInputType
  placeholder: string
  /** Choices for a `select` field; empty for every other input type. */
  options: string[]
}

const fixed = (
  key: LeadPayloadKey,
  role: FormFieldRole,
  label: string,
  inputType: FormFieldInputType,
  required = false,
): PublicLeadField => ({ id: key, key, role, label, required, inputType, placeholder: '', options: [] })

/**
 * The fixed fallback field set, matching what `FixedLeadForm` renders when the
 * MC has not customised the Website form. Keep the two in step.
 */
export const FIXED_LEAD_FIELDS: PublicLeadField[] = [
  fixed('name', 'name', 'Your name', 'text', true),
  fixed('partner_name', 'partnerName', "Partner's name", 'text'),
  fixed('email', 'email', 'Email', 'email', true),
  fixed('phone', 'phone', 'Phone', 'tel'),
  fixed('wedding_date', 'weddingDate', 'Wedding date', 'date'),
  fixed('venue', 'venue', 'Venue', 'text'),
  fixed('referral_source', 'referral', 'How did you hear about me?', 'text'),
  fixed('message', 'message', 'Message', 'text'),
]

/**
 * The public field list for a saved block tree, or the fixed set when there is
 * none. Hidden blocks are omitted. `name` is always reported required because
 * a couple row cannot be created without one.
 */
export function leadFormFields(blocks: Block[] | null): PublicLeadField[] {
  if (!blocks || blocks.length === 0) return FIXED_LEAD_FIELDS
  const mapped = leadFieldBlocks(blocks)
    .filter((b) => !b.hidden)
    .map((b): PublicLeadField => ({
      id: b.id,
      key: payloadKeyForRole(b.role) ?? 'custom',
      role: b.role,
      label: b.label || 'Field',
      required: b.role === 'name' ? true : b.required,
      inputType: b.inputType,
      placeholder: b.placeholder ?? '',
      options: b.inputType === 'select' ? (b.options ?? []).filter((o) => o.trim() !== '') : [],
    }))
  // `missingRequiredFields` always requires `name` (a couple row cannot be
  // created without one), so a tree whose name field is hidden or was never
  // added must still advertise it here: otherwise a third party building a
  // form from this list would never render the one field the server always
  // rejects a submission for.
  if (mapped.some((f) => f.key === 'name')) return mapped
  return [FIXED_LEAD_FIELDS[0]!, ...mapped]
}

/** The subset of a submit payload the required check looks at. */
export type LeadFieldValues = Partial<Record<LeadPayloadKey, string | undefined>> & {
  custom?: Array<{ label: string; value: string }> | undefined
}

const present = (v: string | undefined): boolean => (v ?? '').trim() !== ''

/**
 * Which required fields are missing from a payload, keyed the way the 400
 * response reports them: canonical fields by payload key, custom fields as
 * `custom.<label>`. Custom labels match case-insensitively after trimming.
 * Always includes `name` when blank, regardless of the form config.
 */
export function missingRequiredFields(
  fields: PublicLeadField[],
  payload: LeadFieldValues,
): Record<string, string> {
  const missing: Record<string, string> = {}
  if (!present(payload.name)) missing.name = 'Required'
  for (const field of fields) {
    if (!field.required) continue
    if (field.key === 'custom') {
      const label = field.label.trim().toLowerCase()
      const answered = (payload.custom ?? []).some(
        (c) => c.label.trim().toLowerCase() === label && present(c.value),
      )
      if (!answered) missing[`custom.${field.label}`] = 'Required'
    } else if (!present(payload[field.key])) {
      missing[field.key] = 'Required'
    }
  }
  return missing
}
