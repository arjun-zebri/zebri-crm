/**
 * Bringing a proposal's `proposal_options` rows back in step with its own
 * layout, after the editor has saved that layout.
 *
 * The rows are seeded once, at create time, from the template's packages
 * section (`createProposalFromTemplateAction`). Nothing kept them current
 * afterwards: an MC who changed a price, a title or an add-on in the
 * proposal's own design left the couple reading the new figure off the
 * layout while the contract and the invoice were still being built from
 * the old row. That is real money, quietly wrong, so the layout save
 * re-seeds the rows whenever the two have drifted apart.
 *
 * A plain module rather than another `'use server'` file: it is called by
 * `./proposals.ts`, never by a client, and keeping it here leaves that
 * actions file at its line budget.
 *
 * @module features/proposals/data/resync-options
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/alerts/logger'
import { optionsMatchLayout } from '@/lib/proposals/options-match'
import { replaceOptions } from '@/lib/proposals/write-options'
import type { Database } from '@/types/database'

import type { ProposalLayout } from '../model/layout'
import { layoutPackageOptions, packageOptionsToInputs } from '../model/seed-options'

/** What {@link resyncProposalOptions} needs to know about the save that just landed. */
export interface ResyncProposalOptionsInput {
  proposalId: string
  /** The signed-in MC, stamped on every row it writes for RLS. */
  userId: string
  /** The layout as just saved: the options are derived from its packages section. */
  layout: ProposalLayout
}

/**
 * Rewrite `proposalId`'s options from `layout`, but only when they differ
 * from what is already stored.
 *
 * Resolves rather than throws on every failure, including a Supabase error.
 * The MC's layout is already saved by the time this runs and their work is
 * the priority: a re-seed that could not happen is logged for triage and
 * corrected by the next save, whereas a thrown error here would tell them
 * their design had not been saved when it had.
 */
export async function resyncProposalOptions(
  supabase: SupabaseClient<Database>,
  { proposalId, userId, layout }: ResyncProposalOptionsInput,
): Promise<void> {
  try {
    const desired = packageOptionsToInputs(layoutPackageOptions(layout))
    // Status and options in one read: RLS scopes both, so a proposal that
    // is not this MC's simply comes back as no row at all. The embed names
    // its foreign key because there are two between these tables
    // (`proposal_options.proposal_id` and `proposals.accepted_option_id`),
    // and without the hint PostgREST cannot tell which one is meant.
    const { data, error } = await supabase
      .from('proposals')
      .select('status, proposal_options!proposal_options_proposal_id_fkey(position, title, description, pricing_mode, fixed_price, gst_inclusive, weekend_loading_percent, is_popular, proposal_option_items(position, description, amount, quantity, is_addon, default_included))')
      .eq('id', proposalId)
      .maybeSingle()
    if (error) throw error
    if (!data) return
    // An accepted proposal is frozen: the contract and the invoice were
    // built from these exact rows, so they are history now, not a draft.
    // `updateProposalLayoutAction` will not have saved a layout for one
    // either; this is the belt to that braces.
    if (data.status === 'accepted') return
    // Re-seeding deletes and reinserts, minting new row ids. The editor
    // autosaves every 800ms, so doing it on an unchanged packages section
    // would churn those ids under a couple with the page open.
    if (optionsMatchLayout(data.proposal_options, desired)) return
    await replaceOptions(supabase, proposalId, userId, desired)
  } catch (err) {
    logger.error('proposal_options_resync_failed', err, { userId, proposalId })
  }
}
