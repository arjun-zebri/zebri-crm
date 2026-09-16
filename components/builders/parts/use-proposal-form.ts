/**
 * State + persistence for the proposal builder.
 *
 * Owns the editable form, loads an existing proposal into it, tracks dirty
 * state, and exposes save / send / delete / revert mutations. The modal
 * and the parts stay presentational. The form <-> row mapping itself lives
 * in `@/lib/proposals/form-mapping` (pure, no React) so it stays testable
 * on its own and this file stays a thin hook.
 *
 * @module components/builders/parts/use-proposal-form
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  deleteProposalAction,
  revertProposalToDraftAction,
  saveProposalAction,
} from '@/app/(dashboard)/proposals/actions';
import { PROPOSALS_QUERY_KEY } from '@/app/(dashboard)/proposals/use-proposals';
import { emptyForm } from '@/lib/proposals/form-factories';
import { fromRow, toInput, type ProposalFormState, type ProposalRow } from '@/lib/proposals/form-mapping';
import { createClient } from '@/lib/supabase/client';

/**
 * Form state + mutations for the proposal builder modal.
 *
 * @param proposalId - `null` for a new proposal.
 * @param initialCoupleId - Pre-selected couple when opened from a couple's profile.
 * @param isOpen - Gates the detail fetch so a closed modal does not query.
 */
export function useProposalForm(proposalId: string | null, initialCoupleId: string | null, isOpen: boolean) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProposalFormState>(() => emptyForm(initialCoupleId));
  const [dirty, setDirty] = useState(false);

  const { data: loaded, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    enabled: isOpen && !!proposalId,
    // A focus-triggered refetch landing over unsaved typing is exactly
    // the clobber the re-seed guard below exists to prevent.
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Two FKs exist between proposals and proposal_options (the parent
      // link, plus proposals.accepted_option_id), so the embed must be
      // hinted or PostgREST rejects it as ambiguous (PGRST201).
      const { data, error } = await supabase
        .from('proposals')
        .select('*, proposal_options!proposal_options_proposal_id_fkey(*, proposal_option_items(*))')
        .eq('id', proposalId!)
        .single();
      if (error) throw error;
      return data as ProposalRow;
    },
  });

  // Re-seed on a fresh row, adjusting state during render (React's
  // sanctioned "reset on new data" pattern) rather than a `useEffect`,
  // which trips this repo's `react-hooks/set-state-in-effect` ESLint
  // error and costs an extra render. Guarded on `!dirty || id differs`:
  // an invalidated query resolving over unsaved edits on the *same*
  // proposal must not clobber them, but a *different* proposal's data
  // (switching documents) always replaces whatever draft was showing.
  const [seededRow, setSeededRow] = useState<ProposalRow | null>(null);
  if (loaded && loaded !== seededRow && (!dirty || loaded.id !== form.proposalId)) {
    setSeededRow(loaded);
    setForm(fromRow(loaded));
    setDirty(false);
  }

  const update = useCallback((patch: Partial<ProposalFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['proposal', form.proposalId] });
    void queryClient.invalidateQueries({ queryKey: ['couple-proposals', form.coupleId] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = await saveProposalAction(toInput(form));
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (d) => {
      setForm((f) => ({ ...f, proposalId: d.id, version: d.version }));
      setDirty(false);
      invalidate();
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      let id = form.proposalId;
      if (dirty || !id) {
        const r = await saveProposalAction(toInput(form));
        if (!r.ok) throw new Error(r.error);
        id = r.data.id;
        // Commit the implicit save BEFORE the send POST below: if that
        // fails, `form.proposalId` must not stay null, or clicking Send
        // again saves a second time and mints a duplicate proposal.
        setForm((f) => ({ ...f, proposalId: id, version: r.data.version }));
        setDirty(false);
        invalidate();
      }
      const res = await fetch('/api/email/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to send');
      return id;
    },
    onSuccess: (id) => {
      setForm((f) => ({ ...f, proposalId: id, status: 'sent', shareTokenEnabled: true, emailSentAt: new Date().toISOString() }));
      setDirty(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!form.proposalId) return;
      const r = await deleteProposalAction(form.proposalId);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: invalidate,
  });

  const revert = useMutation({
    mutationFn: async () => {
      if (!form.proposalId) return;
      const r = await revertProposalToDraftAction(form.proposalId);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setForm((f) => ({ ...f, status: 'draft', shareTokenEnabled: false }));
      invalidate();
    },
  });

  return { form, update, dirty, isLoading: !!proposalId && isLoading, save, send, remove, revert };
}
