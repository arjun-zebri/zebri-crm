'use client'

/**
 * The template flavour of the layout autosave: a thin wrapper over
 * {@link useLayoutAutosave} with the target pinned to `proposal_templates`.
 *
 * The four autosave layers themselves (debounced save, revision guard,
 * local draft, unload beacon) and the reasoning behind each one moved to
 * `use-layout-autosave.ts` when the editor learned to mount on a
 * proposal's own copy of a design (roadmap R3 §6.1). Read that module doc
 * first; nothing about a template's behaviour changed. This export stays
 * so the template editor and its tests keep one obvious entry point.
 *
 * @module features/proposals/editor/use-template-autosave
 */
import type { ProposalLayout } from '../model/layout'

import { useLayoutAutosave, type UseTemplateAutosaveOptions, type UseTemplateAutosaveReturn } from './use-layout-autosave'

export type { UseTemplateAutosaveOptions, UseTemplateAutosaveReturn } from './use-layout-autosave'

/** Autosaves `layout` for template `id`. See `use-layout-autosave.ts` for the four layers. */
export function useTemplateAutosave(id: string, layout: ProposalLayout, options: UseTemplateAutosaveOptions): UseTemplateAutosaveReturn {
  // The object is rebuilt on every render on purpose: `useLayoutAutosave`
  // reads `kind` and `id` off it immediately and depends on those
  // primitives, never on the object's identity.
  return useLayoutAutosave({ kind: 'template', id }, layout, options)
}
