/**
 * Positions one or more `ResizeGrip`s over a selected node view without
 * blocking clicks anywhere else in it: the wrapper itself ignores pointer
 * events so a click that misses a grip falls through to the node view's
 * own `onClickCapture` (select-on-click), while each grip inside it (an
 * absolutely positioned child) opts back in.
 *
 * @module features/proposals/editor/node-views/node-grips
 */
import type { ReactNode } from 'react'

/** Props for {@link NodeGrips}. */
export interface NodeGripsProps {
  children: ReactNode
}

/** Overlay that hosts a node view's resize grips; requires a `relative` ancestor to anchor against. */
export function NodeGrips({ children }: NodeGripsProps) {
  return <div className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto">{children}</div>
}
