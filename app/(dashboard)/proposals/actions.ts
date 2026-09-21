/**
 * Server actions for the proposal builder and detail page.
 *
 * Every action Zod-validates on the server, uses the RLS-scoped client
 * (never the service role), and returns a tagged result the UI can
 * pattern-match on. No rate limit: authenticated, single-user, and the
 * send route carries its own limit.
 *
 * Options and items are replaced wholesale on every save (see
 * `./write-options`).
 *
 * @module app/(dashboard)/proposals/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { saveProposalSchema } from '@/lib/proposals/schemas';
import type { SaveProposalInput } from '@/lib/proposals/types';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { releasePendingContract } from './release-pending-contract';
import { replaceOptions } from './write-options';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Create or update a proposal with its options and items.
 *
 * Editing a proposal that has already gone out (`sent`, `viewed`,
 * `declined`) bumps `version` and clears the decline so the couple sees a
 * fresh offer at the same link (D13). An accepted proposal is locked: the
 * contract and invoice already exist, so edits go through those documents.
 * A proposal mid-close (the couple accepted but has not signed) drops its
 * draft contract and the recorded choice with the edit; one whose contract
 * is already signed is refused the same way as an accepted one (S3b).
 */
export async function saveProposalAction(
  input: SaveProposalInput,
): Promise<ActionResult<{ id: string; version: number }>> {
  const parsed = saveProposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal data.' };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const fields = {
    couple_id: d.coupleId,
    event_id: d.eventId,
    title: d.title,
    intro_note: (d.introNote ?? null) as Json | null,
    hero_override: (d.heroOverride ?? null) as Json | null,
    expires_at: d.expiresAt,
    deposit_percent: d.depositPercent,
    payment_schedule_id: d.paymentScheduleId,
    contract_template_id: d.contractTemplateId,
  };

  try {
    let id = d.proposalId;
    let version = 1;

    if (id) {
      const { data: existing, error: readErr } = await supabase
        .from('proposals')
        .select('status, version, contract_id')
        .eq('id', id)
        .single();
      if (readErr || !existing) throw readErr ?? new Error('proposal not found');
      if (existing.status === 'accepted') {
        return { ok: false, error: 'This proposal has been accepted and can no longer be edited.' };
      }
      if (existing.contract_id) {
        const released = await releasePendingContract(supabase, existing.contract_id);
        if (!released.ok && released.error === 'already_accepted') {
          return { ok: false, error: 'This proposal has been accepted and can no longer be edited.' };
        }
        if (!released.ok) throw new Error(`could not release pending contract: ${released.error}`);
      }
      const wentOut = existing.status !== 'draft';
      version = wentOut ? existing.version + 1 : existing.version;
      const { error } = await supabase
        .from('proposals')
        .update({
          ...fields,
          version,
          ...(wentOut
            ? {
                status: 'sent',
                declined_at: null,
                declined_reason: null,
                declined_message: null,
                accepted_option_id: null,
                accepted_addon_selection: null,
                accepted_at: null,
              }
            : {}),
          // The pending draft (if any) is gone: the stale sign token died
          // with it and the couple re-chooses against this version.
          ...(existing.contract_id ? { contract_id: null, accepted_option_id: null, accepted_addon_selection: [] } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_proposal_number', { p_user_id: user.id });
      if (numErr) throw numErr;
      const { data: inserted, error: insErr } = await supabase
        .from('proposals')
        .insert({ user_id: user.id, status: 'draft', proposal_number: num as string, ...fields })
        .select('id')
        .single();
      if (insErr || !inserted) throw insErr ?? new Error('insert returned no row');
      id = inserted.id;
    }

    await replaceOptions(supabase, id, user.id, d.options);

    return { ok: true, data: { id, version } };
  } catch (err) {
    logger.error('[proposals/actions] saveProposalAction failed', {
      userId: user.id,
      proposalId: d.proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the proposal. Please try again.' };
  }
}

/** Delete a proposal; options and items cascade. */
export async function deleteProposalAction(proposalId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase.from('proposals').delete().eq('id', parsed.data);
  if (error) {
    logger.error('[proposals/actions] deleteProposalAction failed', { userId: user.id, proposalId, error: error.message });
    return { ok: false, error: 'Could not delete the proposal.' };
  }
  return { ok: true, data: undefined };
}

/** Pull a sent proposal back: link off, status draft. Accepted ones stay. */
export async function revertProposalToDraftAction(proposalId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'draft', share_token_enabled: false })
    .eq('id', parsed.data)
    .neq('status', 'accepted');
  if (error) {
    logger.error('[proposals/actions] revertProposalToDraftAction failed', { userId: user.id, proposalId, error: error.message });
    return { ok: false, error: 'Could not revert the proposal.' };
  }
  return { ok: true, data: undefined };
}
