/**
 * Server action for the proposal role chooser (D12): remembers which
 * services the MC sells and, on the very first choice, seeds two starter
 * packages so the proposal builder has something to offer straight away.
 *
 * @module app/(dashboard)/branding/proposal-role-actions
 */
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { PROPOSAL_STARTER_PACKAGES } from '@/lib/proposals/starter-packages'
import { PROPOSAL_ROLES, type ProposalRole } from '@/lib/proposals/types'
import { createClient } from '@/lib/supabase/server'

/** Position gap between seeded rows, matching the templates starter-actions step. */
const POSITION_STEP = 1000

const roleSchema = z.enum(PROPOSAL_ROLES as [ProposalRole, ...ProposalRole[]])

/** Tagged result: every server action in this file returns one of these. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Remember the MC's proposal role and, if they have no packages at all, seed
 * two starter packages for that role so the builder has something to offer
 * on the first proposal.
 *
 * Idempotent: a second call (with the same role or a different one) only
 * updates `user_branding.proposal_role`, it never re-seeds packages once the
 * MC owns at least one, so it is always safe to call again from the editor's
 * role chooser and from onboarding.
 */
export async function chooseProposalRoleAction(role: ProposalRole): Promise<ActionResult<{ packagesAdded: number }>> {
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, error: 'Invalid role.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error: roleError } = await supabase
    .from('user_branding')
    .upsert(
      { user_id: user.id, proposal_role: parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (roleError) {
    logger.error('[branding/proposal-role] role upsert failed', roleError, { userId: user.id })
    return { ok: false, error: 'Could not save your choice.' }
  }

  // Only seed starter packages the very first time: an MC who already has
  // packages (from starter-actions, a manual add, or a prior role choice)
  // keeps exactly what they have.
  const { count } = await supabase.from('packages').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) > 0) return { ok: true, data: { packagesAdded: 0 } }

  let added = 0
  for (const [i, set] of PROPOSAL_STARTER_PACKAGES[parsed.data].entries()) {
    const { data: parent, error } = await supabase
      .from('packages')
      .insert({
        user_id: user.id,
        name: set.name,
        notes: set.subtitle,
        is_starter: true,
        position: (i + 1) * POSITION_STEP,
      })
      .select('id')
      .single()
    if (error || !parent) {
      logger.error('[branding/proposal-role] starter package insert failed', error, { userId: user.id })
      return { ok: false, error: 'Could not add starter packages.' }
    }

    const rows = set.items.map((it, j) => ({
      package_id: parent.id,
      user_id: user.id,
      description: it.description,
      amount: it.amount,
      quantity: 1,
      optional: false,
      position: (j + 1) * POSITION_STEP,
    }))
    const { error: itemsError } = await supabase.from('package_items').insert(rows)
    if (itemsError) {
      logger.error('[branding/proposal-role] starter package_items insert failed', itemsError, { userId: user.id })
      return { ok: false, error: 'Could not add starter packages.' }
    }
    added += 1
  }
  return { ok: true, data: { packagesAdded: added } }
}
