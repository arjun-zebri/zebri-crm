'use client'

/**
 * The proposal editor's load gate (roadmap R3 §6.1, "Edit"): fetches one
 * proposal's own copy of a template design plus the account's branding,
 * then mounts {@link ProposalEditorBody} once both are ready.
 *
 * The same shape as `template-editor.tsx`, for the same reasons: the load
 * is split from the editing UI so `useLayoutEditor` only ever sees one
 * real, loaded layout at mount (remounting it on every fetch would reset
 * undo history), a background refetch failure never unmounts a loaded
 * body, a proposal that cannot be edited reaches `Empty` rather than a
 * dead-end `ErrorState` whose retry could not succeed, and a failed
 * branding fetch gets an error state instead of spinning forever.
 *
 * @module features/proposals/editor/proposal-editor
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'

import { getProposalDesignAction, type ProposalDesignRecord } from '../data/proposals'

import { EditorSkeleton } from './editor-skeleton'
import { GateState } from './gate-state'
import { draftKey, readDraft, reconcileDraft } from './local-draft'
import { ProposalEditorBody } from './proposal-editor-body'

/** react-query key for one proposal's design, shared by the load and the rename/send-triggered refetch. */
const queryKey = (id: string) => ['proposal-design', id] as const

/**
 * The `/proposals` list's own react-query key (`use-proposals.ts`'s
 * `PROPOSALS_QUERY_KEY`). Repeated here verbatim rather than imported:
 * `features/proposals` cannot import from `app/` (the feature boundary),
 * so a rename or a send here has to invalidate it by the string it already
 * knows the list uses.
 */
const PROPOSALS_LIST_QUERY_KEY = ['all-proposals'] as const

/**
 * The two `getProposalDesignAction` failures that are data rather than
 * faults: an id that is missing or another account's, and a proposal that
 * predates R3 and carries no layout at all. Both belong in `Empty`, where
 * there is nothing to retry.
 */
const NO_DESIGN_ERRORS = ['Proposal not found', 'This proposal has no design yet']

/** Props for {@link ProposalEditor}. */
export interface ProposalEditorProps {
  proposalId: string
  /** The signed-in user's id, scoping the local draft. `null` disables the draft. */
  userId: string | null
}

/** Loads proposal `proposalId`; renders `EditorSkeleton` / `ErrorState` / `Empty` until it and the branding are both ready. */
export function ProposalEditor({ proposalId, userId }: ProposalEditorProps) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: queryKey(proposalId),
    // The editor owns the layout once it has loaded - autosave keeps the
    // server copy current - so a background refetch (window focus, the
    // app-wide 60s default `staleTime`) would only ever fight the in-memory
    // undo history for no benefit. Rename and send still refresh the row
    // explicitly, through `invalidateQueries` in `onChanged` below.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<ProposalDesignRecord | null> => {
      const result = await getProposalDesignAction(proposalId)
      if (!result.ok) {
        if (NO_DESIGN_ERRORS.includes(result.error)) return null
        throw new Error(result.error)
      }
      return result.proposal
    },
  })
  const { branding, loading: brandingLoading } = useCurrentBranding('proposal')
  // This route's proposal already exists, so "create it" is just "hand
  // back the row we loaded". `ProposalEditorBody` takes the same resolver
  // either way, which is what lets rename and send stay identical between
  // this route and `/proposals/design/new`.
  const revisionLoaded = query.data?.layoutRevision ?? 0
  const materialise = useCallback(async () => ({ id: proposalId, revision: revisionLoaded }), [proposalId, revisionLoaded])
  // The local draft is reconciled once per loaded row (see
  // `local-draft.ts`), keyed by the `'proposal'` kind so it can never be
  // read into the template the proposal was created from.
  const loaded = query.data
  const mounted = useMemo(() => {
    if (!loaded) return null
    const draft = userId ? readDraft(draftKey(userId, loaded.id, 'proposal')) : null
    return reconcileDraft({ layout: loaded.layout, revision: loaded.layoutRevision }, draft)
  }, [loaded, userId])

  if (query.isLoading) return <EditorSkeleton />
  // `query.error && !query.data`, not just `query.error`: a *background*
  // refetch failure must not unmount `ProposalEditorBody` while a good
  // cached copy is still sitting in `query.data` - that would drop undo
  // history and any pending autosave for no reason.
  if (query.error && !query.data) {
    return (
      <GateState>
        <ErrorState title="Could not load this proposal" error={query.error} onRetry={() => void query.refetch()} />
      </GateState>
    )
  }
  if (!query.data || !mounted) {
    return <GateState><Empty title="No design for this proposal" description="It may have been deleted, or it was built before the new editor." /></GateState>
  }
  if (brandingLoading) return <EditorSkeleton />
  if (!branding) {
    // `useCurrentBranding` exposes no `error`: a failed branding fetch is
    // indistinguishable from "still loading" (`loading: false`, `branding:
    // null`, same as a slow-but-fine fetch one tick before it resolves).
    // Without this branch a genuine failure just spun the loading state
    // forever with no way out.
    return <GateState><ErrorState title="Could not load your branding" /></GateState>
  }

  return (
    <ProposalEditorBody
      proposalId={proposalId}
      materialise={materialise}
      userId={userId}
      title={query.data.title}
      status={query.data.status}
      coupleName={query.data.coupleName}
      templateName={query.data.templateName}
      initial={mounted.layout}
      initialDirty={mounted.dirty}
      revision={query.data.layoutRevision}
      branding={branding}
      onChanged={() => {
        void qc.invalidateQueries({ queryKey: queryKey(proposalId) })
        void qc.invalidateQueries({ queryKey: PROPOSALS_LIST_QUERY_KEY })
      }}
    />
  )
}
