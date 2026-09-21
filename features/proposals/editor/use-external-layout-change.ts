'use client'

/**
 * The "external layout change" watcher `useLayoutEditor` (`./use-layout-editor.ts`)
 * runs on its own layout state: catches every change that did not come
 * from `dispatch` (Cmd+Z/Ctrl+Z, wired up by `useHistory`'s own window
 * listener and bypassing `useLayoutEditor` entirely; `replaceLayout`,
 * which `dispatch` flags as external on purpose - see that module's
 * doc), clears a node selection it may have left dangling, and bumps a
 * counter `ContentSectionEditor` watches (`state.externalVersion`) to
 * re-hydrate its live TipTap doc only then - never on an ordinary edit
 * dispatch, which must not reset an editor mid-transaction (the Phase 2
 * fix report has the live-reproduced bug this closes).
 *
 * Split out of `use-layout-editor.ts` to keep that file near its line
 * budget; `dispatchedLayoutChangeRef` and `setSelection` stay owned by
 * `useLayoutEditor` itself (`dispatch` is the only thing that ever writes
 * the former, and the latter is `useLayoutEditor`'s own plain selection
 * state), so both are passed in rather than duplicated here.
 *
 * @module features/proposals/editor/use-external-layout-change
 */
import { useEffect, useRef, useState, type RefObject } from 'react'

import type { ProposalLayout } from '../model/layout'

import type { Selection } from './state'

/**
 * Runs the watcher effect described above for one `layoutState` value.
 * Returns the current `externalVersion` - 0 until the first external
 * change, then incrementing by one on every one after that.
 */
export function useExternalLayoutChange(
  layoutState: ProposalLayout,
  dispatchedLayoutChangeRef: RefObject<boolean>,
  setSelection: (updater: (prev: Selection) => Selection) => void,
): number {
  const [externalVersion, setExternalVersion] = useState(0)
  // Guards the effect's very first run (mount): there has been no
  // dispatch and no external change yet, so mounting itself must not
  // count as one - `externalVersion` starts at 0 and stays there until a
  // real undo/redo/replaceLayout happens.
  const isMountRef = useRef(true)

  useEffect(() => {
    if (dispatchedLayoutChangeRef.current) {
      dispatchedLayoutChangeRef.current = false
      return
    }
    const mounting = isMountRef.current
    isMountRef.current = false
    // Intentional: synchronises the node selection with a layout change
    // from outside `dispatch` (useHistory's own window Cmd+Z/Ctrl+Z
    // listener, or a `replaceLayout` dispatch flagged external on
    // purpose); gated on `prev.node` so it is a no-op (no cascade) once
    // there is nothing left to clear. `setSelection` is a plain function
    // parameter here, not a `useState` setter the lint rule can see, so
    // no `eslint-disable` is needed (or accepted) for this call.
    setSelection((prev) => (prev.node ? { ...prev, node: null } : prev))
    if (mounting) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same external-change catch as above: bumps the counter ContentSectionEditor watches to re-hydrate only on a real external change, never on an ordinary dispatch-driven edit
    setExternalVersion((v) => v + 1)
  }, [layoutState, dispatchedLayoutChangeRef, setSelection])

  return externalVersion
}
