'use client'

/**
 * The proposal flavour of the loaded editor: {@link LayoutEditorBody} with
 * the autosave pointed at `proposals`, rename wired to
 * `renameProposalAction`, the couple's-copy badge in the header's context
 * slot, Send to couple in its trailing slot (roadmap R3 §6.1), and the
 * one-time explainer over the top of it all.
 *
 * The canvas, bars, shortcuts and the four autosave layers are shared
 * verbatim with the template editor (`layout-editor-body.tsx`); this file
 * only supplies the few things that differ per kind, so the two editors
 * can never drift into being two different editors.
 *
 * It mounts on a proposal that already exists (`/proposals/[id]/design`)
 * or on one that does not yet (`/proposals/design/new`, where the row is
 * created by the first save). Everything below that needs an id goes
 * through {@link ProposalEditorBodyProps.materialise}, so neither a
 * rename nor a send has to know which of the two it is in.
 *
 * @module features/proposals/editor/proposal-editor-body
 */
import { useCallback } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import { renameProposalAction } from '../data/proposals'
import type { ProposalLayout } from '../model/layout'

import { DesignExplainerModal } from './design-explainer-modal'
import { LayoutEditorBody } from './layout-editor-body'
import { ProposalCopyBadge } from './proposal-copy-badge'
import { SendToCoupleButton } from './send-to-couple-button'
import type { LayoutTarget, MaterialisedTarget } from './use-layout-autosave'

/** Props for {@link ProposalEditorBody}. */
export interface ProposalEditorBodyProps {
  /** The proposal being edited, or `null` when it has not been created yet. */
  proposalId: string | null
  /**
   * Creates the proposal row and returns it, for the editor mounted
   * before one exists. Must be idempotent: a save, a rename and a send
   * can all reach it, and only one proposal may ever come of them. The
   * `/proposals/[id]/design` route passes a resolver that just hands back
   * the row it already loaded.
   */
  materialise: () => Promise<MaterialisedTarget>
  /** Told the new id the moment the row exists, so the route can swap its URL. */
  onCreated?: (id: string) => void
  /** Scopes the local draft (`use-layout-autosave.ts`); `null` disables it. */
  userId: string | null
  /** The proposal's title: what the couple sees at the top of the page and in the email subject. */
  title: string
  /** The proposal's status as loaded. `accepted` is frozen, so it gets no Send action at all. */
  status: string
  /** The couple this proposal is for. Named in the header so the MC can see whose copy they are editing. */
  coupleName: string
  /** The template it was copied from, or `null`. Named in the header's tooltip as the thing this edit does not touch. */
  templateName: string | null
  initial: ProposalLayout
  /** True when `initial` is a restored local draft the server does not hold yet. */
  initialDirty: boolean
  /** The proposal's `layout_revision` as loaded: every autosave carries it back. */
  revision: number
  branding: PublicBranding
  /** Refetches the proposal row once a rename or a send lands, so the header shows server-confirmed state. */
  onChanged: () => void
}

/** The loaded editor mounted on one proposal's own copy of a design. */
export function ProposalEditorBody({
  proposalId, materialise, onCreated, userId, title, status, coupleName, templateName,
  initial, initialDirty, revision, branding, onChanged,
}: ProposalEditorBodyProps) {
  /** The id to act on, creating the row first if this editor is still mounted on one that does not exist. */
  const ensureId = useCallback(async (): Promise<string> => proposalId ?? (await materialise()).id, [proposalId, materialise])

  const handleRename = useCallback(async (nextTitle: string) => {
    try {
      // Renaming IS a change worth keeping, so it creates the row on the
      // "make edits" route exactly as the first canvas edit would.
      const result = await renameProposalAction({ id: await ensureId(), title: nextTitle })
      if (result.ok) onChanged()
      return result.ok
    } catch {
      // A thrown rejection (network failure, ...) must still resolve to
      // `false`: `NameField.commit` awaits this inside a blur handler and
      // only reverts its optimistic display on a resolved `false`, never
      // on a rejection.
      return false
    }
  }, [ensureId, onChanged])

  // An existing row saves under its id; one that does not exist yet hands
  // the autosave the create to run on its first real save (see
  // `use-layout-autosave.ts`). Conditional spread because `onCreated` is
  // an optional property: under `exactOptionalPropertyTypes` an explicit
  // `undefined` is not the same as an absent key.
  const target: LayoutTarget = proposalId
    ? { kind: 'proposal', id: proposalId }
    : { kind: 'proposal', id: null, create: materialise, ...(onCreated ? { onCreated } : {}) }

  return (
    <>
      <LayoutEditorBody
        target={target}
        userId={userId}
        name={title}
        initial={initial}
        initialDirty={initialDirty}
        revision={revision}
        branding={branding}
        onRename={handleRename}
        context={<ProposalCopyBadge coupleName={coupleName} templateName={templateName} />}
        // An accepted proposal is frozen (the contract and the invoice were
        // built from the design the couple said yes to), so there is nothing
        // to send: the button is not rendered rather than disabled.
        trailing={status === 'accepted' ? null : <SendToCoupleButton resolveProposalId={ensureId} status={status} onSent={onChanged} />}
      />
      <DesignExplainerModal userId={userId} coupleName={coupleName} templateName={templateName} />
    </>
  )
}
