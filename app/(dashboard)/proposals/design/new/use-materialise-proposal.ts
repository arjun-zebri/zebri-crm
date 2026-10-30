'use client';

/**
 * Creates the `proposals` row behind the "Make edits" editor, once, on
 * demand.
 *
 * Why on demand: clicking "Make edits" used to create the proposal up
 * front and then open it. Backing out left an untouched draft behind that
 * `/proposals` counted in its stats and no list could open or delete
 * (founder, 2026-09-23: "it increases the proposal count when youve quit
 * out of it. But you cant see it in the templates"). The row now appears
 * only when the MC actually changes something, or sends.
 *
 * Why here rather than in `features/proposals/`: the create action lives
 * in `app/` because it needs `../../write-options`, and `features/` may
 * not import from `app/`.
 *
 * @module app/(dashboard)/proposals/design/new/use-materialise-proposal
 */
import { useCallback, useRef, useState } from 'react';

import type { MaterialisedTarget } from '@/features/proposals';

import { createProposalFromTemplateAction } from '../../create-from-template';

/**
 * The `layout_revision` a brand new proposal starts at: the column's
 * default (`supabase/migrations/20261005000000_proposal_layout_revision.sql`,
 * `not null default 0`). The first autosave has to be based on it, and
 * `tests/integration/proposals/new-proposal-design.test.ts` fails if that
 * default ever moves.
 */
const NEW_PROPOSAL_REVISION = 0;

/** Options for {@link useMaterialiseProposal}. */
export interface UseMaterialiseProposalOptions {
  coupleId: string;
  templateId: string;
  /** The expiry chosen in the send modal (`YYYY-MM-DD`), or `null` to take the template's / account's default. */
  expiresAt: string | null;
}

/** What {@link useMaterialiseProposal} hands the editor. */
export interface UseMaterialiseProposalResult {
  /** The created proposal's id, or `null` while nothing has been written yet. */
  proposalId: string | null;
  /** Creates the proposal (once) and resolves with the row every save needs. */
  materialise: () => Promise<MaterialisedTarget>;
  /** Handed to the editor so the URL can follow the row into existence. */
  onCreated: (id: string) => void;
}

/** See {@link UseMaterialiseProposalResult}. */
export function useMaterialiseProposal({ coupleId, templateId, expiresAt }: UseMaterialiseProposalOptions): UseMaterialiseProposalResult {
  const [proposalId, setProposalId] = useState<string | null>(null);
  // The create in flight, or the settled one. Single-flight: an autosave,
  // a rename and a Send can all ask at once, and React StrictMode mounts
  // the editor twice in development - none of that may mint the couple a
  // second proposal.
  const pending = useRef<Promise<MaterialisedTarget> | null>(null);

  const materialise = useCallback((): Promise<MaterialisedTarget> => {
    pending.current ??= (async () => {
      const created = await createProposalFromTemplateAction({ coupleId, templateId, expiresAt });
      if (!created.ok) {
        // Cleared so the autosave's own backoff can try again, rather than
        // every later save awaiting one permanently rejected promise.
        pending.current = null;
        throw new Error(created.error);
      }
      return { id: created.proposalId, revision: NEW_PROPOSAL_REVISION };
    })();
    return pending.current;
  }, [coupleId, templateId, expiresAt]);

  const onCreated = useCallback((id: string) => {
    setProposalId(id);
    // `history.replaceState`, not `router.replace`: the App Router would
    // swap this route for `/proposals/[id]/design`, unmounting the editor
    // mid-save. That resets undo history and would drop the very change
    // that created the row. Next.js supports the native call and syncs its
    // own router state from it, so a refresh or a Back lands on the real
    // proposal while the mounted editor carries on untouched.
    window.history.replaceState(null, '', `/proposals/${id}/design`);
  }, []);

  return { proposalId, materialise, onCreated };
}
