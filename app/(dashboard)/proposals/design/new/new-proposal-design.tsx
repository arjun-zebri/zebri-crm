'use client';

/**
 * The "Make edits" editor, mounted on a proposal that does not exist yet.
 *
 * It loads the chosen template and couple, mounts the shared proposal
 * editor on a fresh copy of the template's layout held in memory, and
 * writes nothing at all until the MC changes something (or sends): the
 * create runs inside the autosave's save path, through
 * {@link useMaterialiseProposal}. Opening this page and backing out
 * therefore leaves the account exactly as it was.
 *
 * The same gate shape as `features/proposals/editor/proposal-editor.tsx`
 * for the same reasons: the loads are split from the editor so the canvas
 * only ever mounts once on one real layout, and each failure has somewhere
 * of its own to land.
 *
 * @module app/(dashboard)/proposals/design/new/new-proposal-design
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import {
  cloneLayoutWithFreshIds, EditorSkeleton, GateState, getTemplateAction, ProposalEditorBody, type ProposalLayout,
} from '@/features/proposals';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import { createClient } from '@/lib/supabase/client';

import { PROPOSAL_ANALYTICS_QUERY_KEY } from '../../use-proposal-analytics';
import { PROPOSALS_QUERY_KEY } from '../../use-proposals';

import { useMaterialiseProposal } from './use-materialise-proposal';

/** Props for {@link NewProposalDesign}. */
export interface NewProposalDesignProps {
  /** The template to copy, chosen in the send modal. */
  templateId: string;
  /** The couple the copy is for. */
  coupleId: string;
  /** The expiry the send modal settled on (`YYYY-MM-DD`), or `null` to take the defaults. */
  expiresAt: string | null;
  /** The signed-in user's id, scoping the editor's local draft. `null` disables the draft. */
  userId: string | null;
}

/** The couple's name, which every variable chip in the layout resolves against. */
function useCoupleName(coupleId: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ['couple-name', coupleId],
    queryFn: async (): Promise<string | null> => {
      // RLS is what proves the couple is this MC's: another account's id
      // simply returns no row.
      const { data, error } = await supabase.from('couples').select('name').eq('id', coupleId).maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
  });
}

/** Loads the template and the couple, then mounts the editor on an uncreated proposal. */
export function NewProposalDesign({ templateId, coupleId, expiresAt, userId }: NewProposalDesignProps) {
  const templateQuery = useQuery({
    queryKey: ['proposal-template-design', templateId],
    // The editor owns the layout from here on, so a background refetch
    // could only fight it (`proposal-editor.tsx` says the same).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const result = await getTemplateAction(templateId);
      if (!result.ok) throw new Error(result.error);
      return result.template;
    },
  });
  const coupleQuery = useCoupleName(coupleId);
  const { branding, loading: brandingLoading } = useCurrentBranding('proposal');
  const { proposalId, materialise, onCreated } = useMaterialiseProposal({ coupleId, templateId, expiresAt });
  const qc = useQueryClient();

  // Fresh section ids, exactly as `create-from-template.ts` gives the
  // server's own copy: the proposal is a snapshot, and the two documents
  // must never share the ids the editor keys selection, history and jump
  // buttons off. Memoised so a re-render cannot hand the canvas a second,
  // differently-identified copy of the same layout.
  const layout: ProposalLayout | null = useMemo(
    () => (templateQuery.data ? cloneLayoutWithFreshIds(templateQuery.data.layout) : null),
    [templateQuery.data],
  );

  const coupleName = coupleQuery.data;
  const error = templateQuery.error ?? coupleQuery.error;
  if (error) {
    return (
      <GateState>
        <ErrorState
          title="Could not open the editor"
          error={error}
          onRetry={() => {
            void templateQuery.refetch();
            void coupleQuery.refetch();
          }}
        />
      </GateState>
    );
  }
  if (templateQuery.isLoading || coupleQuery.isLoading || brandingLoading) return <EditorSkeleton />;
  if (!layout || !coupleName) {
    return (
      <GateState>
        <Empty title="Nothing to edit here" description="That template or couple no longer exists. Start again from Proposals." />
      </GateState>
    );
  }
  if (!branding) {
    // `useCurrentBranding` exposes no `error`: a failed fetch looks exactly
    // like one more tick of loading, so without this branch it span forever.
    return <GateState><ErrorState title="Could not load your branding" /></GateState>;
  }

  return (
    <ProposalEditorBody
      proposalId={proposalId}
      materialise={materialise}
      onCreated={onCreated}
      userId={userId}
      // The title the server will give the row, said the same way here so
      // nothing in the header moves when the proposal comes into being
      // (`create-from-template.ts`, which owns the real one).
      title={`${coupleName}, your wedding`}
      status="draft"
      coupleName={coupleName}
      templateName={templateQuery.data?.name ?? null}
      initial={layout}
      initialDirty={false}
      // A row that does not exist is at no revision yet; the real one
      // arrives with the create (`use-materialise-proposal.ts`).
      revision={0}
      branding={branding}
      // A rename or a send here has created the row by definition, so the
      // list the `/proposals` stats and drafts strip read has moved on.
      onChanged={() => {
        void qc.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
        void qc.invalidateQueries({ queryKey: PROPOSAL_ANALYTICS_QUERY_KEY });
      }}
    />
  );
}
