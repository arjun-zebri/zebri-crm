'use server'

/**
 * Server actions for `proposal_settings` (spec §5.1, Phase 4): one row per
 * user holding account-level proposal defaults. RLS (owner-only) and the
 * table itself already shipped in `20260927000000_proposal_layout_v2.sql`;
 * this is the first app code to read or write it.
 *
 * Persist-only for now: nothing on the public proposal page or the
 * proposal-creation path reads these values yet (no password gate, no
 * PDF-download enforcement, no expiry/deposit default applied to new
 * proposals). That enforcement is separate future work — see
 * `.claude/docs/proposals.md`.
 *
 * @module features/proposals/data/settings
 */
import { logger } from '@/lib/alerts/logger'
import { createClient } from '@/lib/supabase/server'
import type { Json, Tables } from '@/types/database'

import { linkPreviewSchema, updateProposalSettingsSchema, type UpdateProposalSettingsInput } from './settings-schemas'

/**
 * The settings form's view-model shape (matching
 * {@link UpdateProposalSettingsInput}'s parsed `link_preview`).
 *
 * `| undefined` on both optional fields: under `exactOptionalPropertyTypes`,
 * Zod's `.optional()` output type is `T | undefined`, not just an absent
 * key, so this only matches `linkPreviewSchema`'s inferred type when the
 * fields say so explicitly (same reasoning as `lib/proposals/types.ts`'s
 * `HeroOverride`).
 */
export interface ProposalSettings {
  password_enabled: boolean
  allow_download: boolean
  expiry_days: number
  deposit_percent: number
  link_preview: { title?: string | undefined; imageUrl?: string | undefined } | null
}

type Fail = { ok: false; error: string }

/** The row's defaults, matching the table's own column defaults — returned
 *  when a user has never opened the settings modal (no insert-on-signup
 *  trigger exists for this table). */
const DEFAULT_SETTINGS: ProposalSettings = {
  password_enabled: false,
  allow_download: true,
  expiry_days: 14,
  deposit_percent: 30,
  link_preview: null,
}

/** Resolve the signed-in user for an action, or a tagged failure when there is none. */
async function currentUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | Fail> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  return { supabase, userId: user.id }
}

/** Parse a stored `link_preview` jsonb value; an invalid/legacy shape is dropped rather than surfaced. */
function toLinkPreview(raw: Json | null): ProposalSettings['link_preview'] {
  if (raw === null) return null
  const parsed = linkPreviewSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function toSettings(row: Tables<'proposal_settings'>): ProposalSettings {
  return {
    password_enabled: row.password_enabled,
    allow_download: row.allow_download,
    expiry_days: row.expiry_days,
    deposit_percent: row.deposit_percent,
    link_preview: toLinkPreview(row.link_preview),
  }
}

/** The signed-in user's proposal defaults, or {@link DEFAULT_SETTINGS} if they have never saved any. */
export async function getProposalSettingsAction(): Promise<{ ok: true; settings: ProposalSettings } | Fail> {
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase
    .from('proposal_settings')
    .select('password_enabled, allow_download, expiry_days, deposit_percent, link_preview, section_nav, updated_at, user_id')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (error) {
    logger.error('proposal_settings_get_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not load your proposal settings' }
  }
  return { ok: true, settings: data ? toSettings(data) : DEFAULT_SETTINGS }
}

/** Save the signed-in user's proposal defaults. Upserts on `user_id` since a first-time save has no existing row. */
export async function updateProposalSettingsAction(raw: unknown): Promise<{ ok: true; settings: ProposalSettings } | Fail> {
  const input = updateProposalSettingsSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid input' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const payload: UpdateProposalSettingsInput = input.data
  const { data, error } = await ctx.supabase
    .from('proposal_settings')
    .upsert(
      {
        user_id: ctx.userId,
        password_enabled: payload.password_enabled,
        allow_download: payload.allow_download,
        expiry_days: payload.expiry_days,
        deposit_percent: payload.deposit_percent,
        link_preview: payload.link_preview as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('password_enabled, allow_download, expiry_days, deposit_percent, link_preview, section_nav, updated_at, user_id')
    .single()
  if (error || !data) {
    if (error) logger.error('proposal_settings_update_failed', error, { userId: ctx.userId })
    return { ok: false, error: 'Could not save your proposal settings' }
  }
  return { ok: true, settings: toSettings(data) }
}
