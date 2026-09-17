'use client'

/**
 * The template editor's load gate (Proposal Layout v2 Phase 2 Task 14):
 * fetches the template and the account's branding, then mounts
 * {@link TemplateEditorBody} once both are ready. Split out from the
 * editing UI itself (`template-editor-body.tsx`) so `useLayoutEditor`
 * only ever sees one real, loaded layout at mount - remounting it on
 * every fetch would otherwise reset undo history.
 *
 * This is the first thing in Phase 2 that mounts on a real route - every
 * editor piece built across Tasks 1-13 (the reducer, the
 * sortable/selectable canvas, the section/node/text bars, the resize
 * handles, the add palette, ...) meets here.
 *
 * Fix round 1 (review): the template query no longer unmounts the loaded
 * body on a background refetch failure, a missing template now reaches
 * `Empty` instead of a dead-end `ErrorState`, and a failed branding fetch
 * gets an error state instead of spinning forever. See the inline
 * comments on each branch below.
 *
 * @module features/proposals/editor/template-editor
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Loading } from '@/components/ui/loading'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'

import { getTemplateAction, type TemplateRecord } from '../data/templates'

import { TemplateEditorBody } from './template-editor-body'

/** react-query key for one template, shared by the load and the rename-triggered refetch. */
const queryKey = (id: string) => ['proposal-template', id] as const

/**
 * The Templates tab list's own react-query key (`templates-list.tsx`'s
 * `KEY`). Repeated here verbatim rather than imported: `features/proposals`
 * cannot import from `app/` (the feature boundary), so a rename here has
 * to invalidate it by the string it already knows the list uses.
 */
const TEMPLATES_LIST_QUERY_KEY = ['proposal-templates'] as const

/** Props for {@link TemplateEditor}. */
export interface TemplateEditorProps {
  templateId: string
}

/**
 * Centres a `Loading` / `ErrorState` / `Empty` gate state. Every other
 * `/proposals` route keeps its padding through `ProposalsFrame`, which this
 * route opts out of for the loaded editor (it needs the full width) - but
 * these transient states are not the editor, so they get their own gutter
 * rather than rendering flush against the corner of the scroll container.
 */
function GateState({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6">{children}</div>
}

/** Loads template `templateId`; renders `Loading` / `ErrorState` / `Empty` until it and the branding are both ready. */
export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: queryKey(templateId),
    // The editor owns the layout once it has loaded - autosave keeps the
    // server copy current - so a background refetch (window focus, the
    // app-wide 60s default `staleTime`) would only ever fight the in-memory
    // undo history for no benefit. The rename flow still refreshes the row
    // explicitly, through `invalidateQueries` in `onRenamed` below.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<TemplateRecord | null> => {
      const result = await getTemplateAction(templateId)
      if (!result.ok) {
        // A missing or foreign id is data, not a failure: mapping it to
        // `null` here (rather than throwing) is what lets `!query.data`
        // reach the `Empty` branch below instead of an `ErrorState` whose
        // retry could never succeed.
        if (result.error === 'Template not found') return null
        throw new Error(result.error)
      }
      return result.template
    },
  })
  const { branding, loading: brandingLoading } = useCurrentBranding('proposal')

  if (query.isLoading) return <GateState><Loading label="Loading template" /></GateState>
  // `query.error && !query.data`, not just `query.error`: a *background*
  // refetch failure must not unmount `TemplateEditorBody` while a good
  // cached copy is still sitting in `query.data` - that would drop undo
  // history and any pending autosave for no reason.
  if (query.error && !query.data) {
    return (
      <GateState>
        <ErrorState title="Could not load this template" error={query.error} onRetry={() => void query.refetch()} />
      </GateState>
    )
  }
  if (!query.data) return <GateState><Empty title="Template not found" description="It may have been deleted." /></GateState>
  if (brandingLoading) return <GateState><Loading label="Loading template" /></GateState>
  if (!branding) {
    // `useCurrentBranding` exposes no `error`: a failed branding fetch is
    // indistinguishable from "still loading" (`loading: false`, `branding:
    // null`, same as a slow-but-fine fetch one tick before it resolves).
    // Without this branch a genuine failure just spun the loading state
    // forever with no way out.
    return <GateState><ErrorState title="Could not load your branding" /></GateState>
  }

  return (
    <TemplateEditorBody
      templateId={templateId}
      name={query.data.name}
      initial={query.data.layout}
      branding={branding}
      onRenamed={() => {
        void qc.invalidateQueries({ queryKey: queryKey(templateId) })
        void qc.invalidateQueries({ queryKey: TEMPLATES_LIST_QUERY_KEY })
      }}
    />
  )
}
