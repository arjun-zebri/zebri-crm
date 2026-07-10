/**
 * Load one proposal + its option/item tree for the composer.
 *
 * Two RLS-scoped queries (proposal row with couple name; options with
 * nested items via the explicit `proposal_options_proposal_id_fkey`
 * relationship — proposals also reference options through
 * `accepted_option_id`, so the join must be disambiguated). Items are
 * mapped straight into the composer's draft shapes so the modal's
 * hydrate effect is a plain assignment.
 *
 * @module components/builders/parts/use-proposal-detail
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

import type { ProposalOptionDraft } from './proposal-option-card';

export interface ProposalDetail {
  id: string;
  title: string;
  proposal_number: string;
  status: string;
  notes: string | null;
  expires_at: string | null;
  share_token: string;
  share_token_enabled: boolean;
  email_sent_at: string | null;
  accepted_option_id: string | null;
  accepted_addon_selection: Record<string, boolean> | null;
  couple_id: string;
  couple_name: string;
}

interface OptionRow {
  id: string;
  position: number;
  title: string;
  description: string | null;
  source_package_id: string | null;
  deposit_percent: number | null;
  gst_inclusive: boolean;
  weekend_loading_percent: number | null;
  proposal_option_items: {
    id: string;
    description: string;
    amount: number;
    is_addon: boolean;
    default_included: boolean;
    position: number;
  }[];
}

export function useProposalDetail(proposalId: string | null) {
  const supabase = createClient();

  const proposalQuery = useQuery({
    queryKey: ['proposal', proposalId],
    enabled: !!proposalId,
    queryFn: async (): Promise<ProposalDetail> => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*, couple:couple_id(name)')
        .eq('id', proposalId!)
        .single();
      if (error) throw error;
      const couple = (data.couple as { name: string } | null) ?? null;
      return {
        ...(data as unknown as Omit<ProposalDetail, 'couple_name'>),
        couple_name: couple?.name ?? '',
      };
    },
  });

  const optionsQuery = useQuery({
    queryKey: ['proposal-options', proposalId],
    enabled: !!proposalId,
    queryFn: async (): Promise<ProposalOptionDraft[]> => {
      const { data, error } = await supabase
        .from('proposal_options')
        .select(
          'id, position, title, description, source_package_id, deposit_percent, gst_inclusive, weekend_loading_percent, proposal_option_items(id, description, amount, is_addon, default_included, position)',
        )
        .eq('proposal_id', proposalId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as OptionRow[]).map((row) => {
        const items = [...row.proposal_option_items].sort((a, b) => a.position - b.position);
        return {
          key: row.id,
          title: row.title,
          description: row.description,
          sourcePackageId: row.source_package_id,
          depositPercent: row.deposit_percent != null ? Number(row.deposit_percent) : null,
          gstInclusive: row.gst_inclusive,
          weekendLoadingPercent:
            row.weekend_loading_percent != null ? Number(row.weekend_loading_percent) : null,
          items: items
            .filter((item) => !item.is_addon)
            .map((item, idx) => ({
              id: item.id,
              description: item.description,
              amount: Number(item.amount),
              position: idx,
            })),
          addOns: items
            .filter((item) => item.is_addon)
            .map((item) => ({
              id: item.id,
              description: item.description,
              amount: Number(item.amount),
              defaultIncluded: item.default_included,
            })),
        };
      });
    },
  });

  return {
    proposal: proposalQuery.data ?? null,
    optionDrafts: optionsQuery.data ?? null,
    loading: proposalQuery.isLoading || optionsQuery.isLoading,
  };
}
