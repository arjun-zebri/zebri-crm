/**
 * Zod input schema for `updateProposalSettingsAction`. A plain module (not
 * `'use server'`) because value exports from an actions file crash at
 * runtime (memory: use_server_value_exports).
 *
 * Shaped to match `proposal_settings`'s own snake_case columns exactly —
 * deliberately NOT a reuse of `pageSettingsSchema` in `../model/schema`,
 * which validates a different, unrelated concept (a per-template/per-proposal
 * `PageSettings.passwordHash`, camelCase, page-builder scoped).
 *
 * @module features/proposals/data/settings-schemas
 */
import { z } from 'zod'

import type { Json } from '@/types/database'

/** Matches `proposal_settings`'s `link_preview` jsonb shape. */
export const linkPreviewSchema = z.object({
  title: z.string().trim().max(120).optional(),
  imageUrl: z.string().trim().url().optional(),
})

/** Input to `updateProposalSettingsAction`. Every field required: an
 *  omitted field would upsert a default over the caller's existing value,
 *  the same bug class `update_payload_whitelist_wipes_fields` names. */
export const updateProposalSettingsSchema = z.object({
  password_enabled: z.boolean(),
  allow_download: z.boolean(),
  expiry_days: z.number().int().min(1).max(365),
  deposit_percent: z.number().int().min(0).max(100),
  link_preview: linkPreviewSchema.nullable(),
})

export type UpdateProposalSettingsInput = z.infer<typeof updateProposalSettingsSchema>

/**
 * Input to `updateTemplateSettingsAction`: the full snapshot (same
 * all-fields-required rule as above) or `null`, which puts the template
 * back on the account defaults.
 */
export const updateTemplateSettingsSchema = z.object({
  id: z.string().uuid(),
  settings: updateProposalSettingsSchema.nullable(),
})

export type UpdateTemplateSettingsInput = z.infer<typeof updateTemplateSettingsSchema>

/**
 * A stored settings snapshot as the app reads it back. Structurally the
 * same as {@link UpdateProposalSettingsInput}; named separately because
 * it describes a row, not a request.
 */
export type ProposalSettingsSnapshot = UpdateProposalSettingsInput

/**
 * Parse a `proposal_templates.settings` jsonb value. A corrupt or legacy
 * shape is dropped (`null`, i.e. "follow the account defaults") rather
 * than surfaced, so one bad row never blanks the templates list.
 */
export function parseStoredSettings(raw: Json | null): ProposalSettingsSnapshot | null {
  if (raw === null) return null
  const parsed = updateProposalSettingsSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * The settings a template actually runs under: its own snapshot when it
 * has one, else the account's. A snapshot is always complete (the schema
 * requires every field), so this is a whole-object choice, not a merge.
 */
export function resolveTemplateSettings(
  account: ProposalSettingsSnapshot,
  override: ProposalSettingsSnapshot | null,
): ProposalSettingsSnapshot {
  return override ?? account
}
