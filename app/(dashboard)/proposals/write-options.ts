/**
 * Writes a proposal's options and items.
 *
 * Options and items are replaced wholesale on every save. The builder
 * always sends the full option list, so a diff would only add ways to
 * leave a stale row behind; deleting the options cascades their items.
 * Split out of `./actions` so that file stays under its line budget.
 *
 * @module app/(dashboard)/proposals/write-options
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { optionBaseSubtotal } from '@/lib/proposals/pricing';
import type { SaveProposalInput } from '@/lib/proposals/types';
import type { Database } from '@/types/database';

/**
 * Replace every option (and its items) on the proposal. Throws on the first
 * Supabase error so the calling action's catch reports it.
 *
 * @param supabase - The signed-in MC's RLS client.
 * @param proposalId - The proposal being saved.
 * @param userId - The MC, stamped on every row for RLS.
 * @param options - The full, validated option list from the builder.
 */
export async function replaceOptions(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  userId: string,
  options: SaveProposalInput['options'],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('proposal_options')
    .delete()
    .eq('proposal_id', proposalId);
  if (delErr) throw delErr;

  for (const opt of options) {
    const { data: row, error: oErr } = await supabase
      .from('proposal_options')
      .insert({
        proposal_id: proposalId,
        user_id: userId,
        position: opt.position,
        title: opt.title,
        description: opt.description,
        source_package_id: opt.sourcePackageId,
        pricing_mode: opt.pricingMode,
        fixed_price: opt.fixedPrice,
        gst_inclusive: opt.gstInclusive,
        weekend_loading_percent: opt.weekendLoadingPercent,
        is_popular: opt.isPopular,
        subtotal:
          opt.pricingMode === 'single' ? (opt.fixedPrice ?? 0) : optionBaseSubtotal(opt.items),
      })
      .select('id')
      .single();
    if (oErr || !row) throw oErr ?? new Error('option insert returned no row');
    if (opt.items.length === 0) continue;
    // Uniform keys on every row: PostgREST bulk insert silently drops rows
    // whose key set differs from the first row's.
    const { error: iErr } = await supabase.from('proposal_option_items').insert(
      opt.items.map((it) => ({
        option_id: row.id,
        user_id: userId,
        description: it.description,
        note: it.note?.trim() ? it.note.trim() : null,
        amount: it.amount,
        quantity: it.quantity,
        is_addon: it.isAddon,
        default_included: it.defaultIncluded,
        position: it.position,
      })),
    );
    if (iErr) throw iErr;
  }
}
