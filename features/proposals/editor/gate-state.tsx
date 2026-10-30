/**
 * The wrapper an editor load gate puts around a transient `ErrorState` or
 * `Empty` (loading is the editor-shaped `EditorSkeleton`, which fills the
 * frame itself).
 *
 * Every other `/proposals` route keeps its padding through
 * `ProposalsFrame`, which the editor routes opt out of so the loaded
 * canvas can use the full width. These states are not the canvas, so they
 * get their own gutter rather than rendering flush against the corner of
 * the scroll container.
 *
 * Shared by `template-editor.tsx` and `proposal-editor.tsx` so the two
 * gates cannot drift apart visually.
 *
 * @module features/proposals/editor/gate-state
 */
import type { ReactNode } from 'react'

/** Centres a gate's `ErrorState` / `Empty` in the editor's frame. */
export function GateState({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6">{children}</div>
}
