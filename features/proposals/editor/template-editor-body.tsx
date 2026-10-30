'use client'

/**
 * The template flavour of the loaded editor: {@link LayoutEditorBody} with
 * the autosave pointed at `proposal_templates` and rename wired to
 * `renameTemplateAction`.
 *
 * Everything that makes the editor an editor (canvas, bars, shortcuts,
 * insert host, autosave layers) lives in `layout-editor-body.tsx` and is
 * shared verbatim with the proposal editor; this file exists so
 * `template-editor.tsx` keeps handing over the same props it always has,
 * and so the rename action stays next to the kind it belongs to.
 *
 * @module features/proposals/editor/template-editor-body
 */
import { useCallback } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import { renameTemplateAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'

import { LayoutEditorBody } from './layout-editor-body'

/** Props for {@link TemplateEditorBody}. */
export interface TemplateEditorBodyProps {
  templateId: string
  /** Scopes the local draft (`use-layout-autosave.ts`); `null` disables it. */
  userId: string | null
  name: string
  initial: ProposalLayout
  /** True when `initial` is a restored local draft the server does not hold yet. */
  initialDirty: boolean
  /** The template's `revision` as loaded: every autosave carries it back. */
  revision: number
  branding: PublicBranding
  /** Refetches the template row once a rename lands, so the header shows the server-confirmed name. */
  onRenamed: () => void
}

/** The loaded editor mounted on a template. */
export function TemplateEditorBody({ templateId, userId, name, initial, initialDirty, revision, branding, onRenamed }: TemplateEditorBodyProps) {
  const handleRename = useCallback(async (nextName: string) => {
    try {
      const result = await renameTemplateAction({ id: templateId, name: nextName })
      if (result.ok) onRenamed()
      return result.ok
    } catch {
      // A thrown rejection (network failure, ...) must still resolve to
      // `false`: `NameField.commit` awaits this inside a blur handler and
      // only reverts its optimistic display on a resolved `false`, never
      // on a rejection.
      return false
    }
  }, [templateId, onRenamed])

  return (
    <LayoutEditorBody
      target={{ kind: 'template', id: templateId }}
      userId={userId}
      name={name}
      initial={initial}
      initialDirty={initialDirty}
      revision={revision}
      branding={branding}
      onRename={handleRename}
    />
  )
}
