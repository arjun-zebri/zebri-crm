'use client'

/**
 * Autosaves a template's layout as it changes in the editor (Proposal
 * Layout v2 Phase 2 Task 14). Every value the debounce flushes is
 * re-validated with `parseProposalLayout` first: a layout the editor
 * itself produced must always pass its own schema, so a failure here
 * means a bug upstream (a reducer branch, or a node view writing an
 * attribute the schema does not allow), never a user mistake. The bad
 * layout is logged and `save` throws - it must never reach the server (a
 * transient editor bug could overwrite a good saved layout with a broken
 * one), and it must not report success either: throwing turns the status
 * into `'error'` ("Save failed", with a retry) instead of `useAutosave`
 * flipping to `'saved'` for a layout that was never sent.
 *
 * Debounced 800ms after the last change (`useAutosave`,
 * `lib/branding/use-autosave.ts`), which also skips the very first
 * render's value, so loading a template and mounting `useLayoutEditor`
 * with its saved layout never fires an immediate, pointless save. A save
 * still pending when the editor unmounts (e.g. clicking Back within
 * 800ms of the last edit) is flushed rather than dropped
 * (`flushOnUnmount`, below).
 *
 * @module features/proposals/editor/use-template-autosave
 */
import { useCallback } from 'react'

import { logger } from '@/lib/alerts/logger'
import { useAutosave, type SaveStatus } from '@/lib/branding/use-autosave'
import { toPlainJSON } from '@/lib/utils'

import { updateTemplateLayoutAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'
import { parseProposalLayout } from '../model/schema'

/** What {@link useTemplateAutosave} returns. */
export interface UseTemplateAutosaveReturn {
  status: SaveStatus
  lastSavedAt: number | null
  /** Re-runs the save with the latest layout after a failure. */
  retry: () => void
}

/** Autosaves `layout` for template `id`. See the module doc for the validate-then-save flow. */
export function useTemplateAutosave(id: string, layout: ProposalLayout): UseTemplateAutosaveReturn {
  const save = useCallback(async (value: ProposalLayout) => {
    const parsed = parseProposalLayout(value)
    if (!parsed.ok) {
      logger.error('proposal_layout_invalid_editor', undefined, { templateId: id, issues: parsed.issues.slice(0, 5) })
      throw new Error('Layout failed validation')
    }
    const result = await updateTemplateLayoutAction({ id, layout: toPlainJSON(parsed.layout) })
    if (!result.ok) throw new Error(result.error)
  }, [id])

  // `flushOnUnmount`: a save still debouncing when the editor unmounts (Back
  // to Templates, or navigating away within 800ms of the last edit) is sent
  // once more with the latest layout instead of silently dropped.
  const { status, lastSavedAt, retry } = useAutosave(layout, save, 800, { flushOnUnmount: true })
  return { status, lastSavedAt, retry }
}
