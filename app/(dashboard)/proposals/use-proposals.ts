/**
 * React Query hooks for the proposals list and detail.
 *
 * @module app/(dashboard)/proposals/use-proposals
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';

import type { HeroOverride, ProposalStatus } from '@/lib/proposals/types';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export interface ProposalListRow {
  id: string;
  proposal_number: string;
  title: string;
  status: ProposalStatus;
  expires_at: string | null;
  email_sent_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
  couple: { id: string; name: string };
  proposal_options: { subtotal: number; is_popular: boolean; position: number }[];
}

export const PROPOSALS_QUERY_KEY = ['all-proposals'] as const;

/** One proposal's full row for the /proposals/[id] detail page. */
export interface ProposalDetailRow extends ProposalListRow {
  version: number;
  share_token: string;
  share_token_enabled: boolean;
  first_viewed_at: string | null;
  view_count: number;
  declined_reason: string | null;
  declined_message: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  proposal_options: { id: string; subtotal: number; is_popular: boolean; position: number; title: string }[];
}

/**
 * Proposals owned by the current user, newest first.
 *
 * Two FKs exist between `proposals` and `proposal_options` (the option's
 * own parent, plus `proposals.accepted_option_id`), so PostgREST cannot
 * infer which one an unqualified embed means and rejects it with
 * PGRST201. The embed below hints the parent-child FK explicitly.
 */
export function useProposals() {
  const supabase = createClient();
  return useQuery({
    queryKey: PROPOSALS_QUERY_KEY,
    queryFn: async (): Promise<ProposalListRow[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, proposal_number, title, status, expires_at, email_sent_at, last_viewed_at, view_count, created_at, couple:couple_id(id, name), proposal_options!proposal_options_proposal_id_fkey(subtotal, is_popular, position)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ProposalListRow[]) ?? [];
    },
  });
}

/**
 * One proposal for the detail page. Same FK-hint reasoning as
 * {@link useProposals}.
 *
 * Deliberately keyed `['proposal-detail', id]`, distinct from the
 * builder's own `['proposal', id]` (`useProposalForm`): the detail page
 * keeps rendering underneath the builder modal when Edit is open, so
 * both queries are mounted at once. Sharing one key would let either
 * query's differently-shaped row silently overwrite the other's cache
 * entry.
 */
export function useProposal(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ['proposal-detail', id],
    queryFn: async (): Promise<ProposalDetailRow | null> => {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, proposal_number, title, status, version, expires_at, email_sent_at, first_viewed_at, last_viewed_at, view_count, created_at, share_token, share_token_enabled, declined_reason, declined_message, contract_id, invoice_id, couple:couple_id(id, name), proposal_options!proposal_options_proposal_id_fkey(id, subtotal, is_popular, position, title)',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProposalDetailRow) ?? null;
    },
  });
}

/**
 * Full dashboard row for one proposal, print-shaped: every column the
 * scalar fields need plus the option and item rows nested underneath, so
 * {@link toPublicProposal} (`lib/proposals/to-public.ts`) can build the
 * exact document `/proposal/[token]` renders.
 *
 * `couple` and `proposal_options` are narrower on {@link ProposalDetailRow}
 * (view-summary shapes for the list/detail pages), so they're redeclared
 * here rather than inherited: `Omit` drops the base pair before restating
 * the wider ones this print path needs.
 */
export interface ProposalPrintRow extends Omit<ProposalDetailRow, 'couple' | 'proposal_options'> {
  intro_note: JSONContent | null;
  hero_override: HeroOverride | null;
  deposit_percent: number | null;
  accepted_option_id: string | null;
  accepted_addon_selection: string[] | null;
  accepted_at: string | null;
  declined_at: string | null;
  couple: { id: string; name: string; event_date: string | null; venue: string | null } | null;
  proposal_options: Array<Tables<'proposal_options'> & { proposal_option_items: Tables<'proposal_option_items'>[] }>;
}

/**
 * On-demand full row for the "Download PDF" action on `/proposals/[id]`.
 * `enabled: false` with a manual `refetch()`: this row carries the whole
 * option/item tree (unlike {@link useProposal}'s summary shape), which the
 * detail page doesn't need until the MC actually asks for the PDF. Same
 * FK-hint reasoning as {@link useProposals}.
 */
export function useProposalForPrint(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ['proposal-print', id],
    enabled: false,
    queryFn: async (): Promise<ProposalPrintRow | null> => {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          '*, couple:couple_id(id, name, event_date, venue), proposal_options!proposal_options_proposal_id_fkey(*, proposal_option_items(*))',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProposalPrintRow) ?? null;
    },
  });
}
