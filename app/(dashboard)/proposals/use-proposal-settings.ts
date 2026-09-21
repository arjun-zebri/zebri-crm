/**
 * React Query hooks for the proposal-settings modal: fetch the signed-in
 * user's account defaults and save them ({@link useProposalSettings}), or
 * save one template's own snapshot ({@link useTemplateSettingsSave}).
 * Toast on failure. Same shape as the Templates tab's
 * `use-template-mutations.ts`.
 *
 * @module app/(dashboard)/proposals/use-proposal-settings
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';
import {
  getProposalSettingsAction,
  updateProposalSettingsAction,
  updateTemplateSettingsAction,
  type ProposalSettings,
  type UpdateProposalSettingsInput,
  type UpdateTemplateSettingsInput,
} from '@/features/proposals';

import { TEMPLATES_QUERY_KEY } from './templates/use-template-mutations';

export const PROPOSAL_SETTINGS_QUERY_KEY = ['proposal-settings'] as const;

/**
 * Fetches the signed-in user's proposal defaults, and exposes a save mutation.
 *
 * @param onSaved - fired once `save` lands successfully (the modal closes itself).
 */
export function useProposalSettings(onSaved?: () => void) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: PROPOSAL_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<ProposalSettings> => {
      const r = await getProposalSettingsAction();
      if (!r.ok) throw new Error(r.error);
      return r.settings;
    },
  });

  const save = useMutation({
    mutationFn: (input: UpdateProposalSettingsInput) => updateProposalSettingsAction(input),
    onSuccess: (r) => {
      if (!r.ok) return toast(r.error, 'error');
      qc.setQueryData(PROPOSAL_SETTINGS_QUERY_KEY, r.settings);
      toast('Proposal settings saved', 'success');
      onSaved?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong', 'error'),
  });

  return { query, save };
}

/**
 * Saves one template's own settings snapshot (`settings: null` puts it back
 * on the account defaults). Invalidates the templates list, which is where
 * the card's `settings` comes from, so the next open seeds correctly.
 *
 * @param onSaved - fired once the save lands successfully (the modal closes itself).
 */
export function useTemplateSettingsSave(onSaved?: () => void) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: UpdateTemplateSettingsInput) => updateTemplateSettingsAction(input),
    onSuccess: (r, input) => {
      if (!r.ok) return toast(r.error, 'error');
      void qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
      toast(input.settings ? 'Template settings saved' : 'Template now uses the account defaults', 'success');
      onSaved?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong', 'error'),
  });
}
