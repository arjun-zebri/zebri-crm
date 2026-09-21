/**
 * The MC re-saves a proposal the couple has already started accepting.
 *
 * `accept_proposal` leaves a draft contract (and the couple's sign token)
 * behind until the signature lands. If the MC edits the proposal in that
 * window, that draft was rendered from the old offer, so it must die with
 * the edit: the couple re-chooses against the new version (ruling S3b).
 * Once signed, the contract is the booking and the edit is refused.
 *
 * @module app/(dashboard)/proposals/release-pending-contract
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** Outcome of {@link releasePendingContract}. */
export type ReleaseResult =
  | { ok: true }
  | { ok: false; error: 'already_accepted' | 'read_error' | 'delete_error' };

/**
 * Delete the proposal's unsigned draft contract so the save can clear the
 * pointer, or refuse when the contract is already signed.
 *
 * Owner-scoped through the caller's RLS client: the MC can only ever see
 * and delete their own contract, so a spoofed pointer resolves to nothing
 * here and is treated as a read error rather than silently ignored.
 *
 * @param supabase - The signed-in MC's RLS client.
 * @param contractId - `proposals.contract_id` as read before the save.
 */
export async function releasePendingContract(
  supabase: SupabaseClient<Database>,
  contractId: string,
): Promise<ReleaseResult> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, status, signed_at')
    .eq('id', contractId)
    .maybeSingle();
  if (error || !contract) return { ok: false, error: 'read_error' };
  if (contract.signed_at !== null || contract.status !== 'draft')
    return { ok: false, error: 'already_accepted' };
  // Signers cascade with the contract, which is what kills the stale sign
  // token the couple may still be holding in an open tab.
  const { error: delErr } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)
    .eq('status', 'draft')
    .is('signed_at', null);
  if (delErr) return { ok: false, error: 'delete_error' };
  return { ok: true };
}
