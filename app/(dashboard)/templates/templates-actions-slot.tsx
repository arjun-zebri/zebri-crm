/**
 * Templates tab-row action slot.
 *
 * Each Templates tab owns its own "Browse starters" / "New …" buttons, but
 * we want those buttons to live up on the tab row (right edge), not inside
 * the tab body. The orchestrator renders an empty slot element on the tab
 * row and exposes it through context; each tab manager renders its buttons
 * into that slot via {@link TemplatesActions} (a portal), so the manager
 * keeps all its own modal state while its actions appear in the shared
 * toolbar. The slot is per-page, so only the active tab's buttons show.
 *
 * @module app/(dashboard)/templates/templates-actions-slot
 */
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** The DOM node the active tab's actions portal into (null until mounted). */
const ActionsSlotContext = createContext<HTMLElement | null>(null)

/** Provides the tab-row action slot node to the tab managers below it. */
export function TemplatesActionsProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null
  children: ReactNode
}) {
  return <ActionsSlotContext.Provider value={slot}>{children}</ActionsSlotContext.Provider>
}

/**
 * Renders its children into the Templates tab-row action slot.
 *
 * Returns `null` until the slot node exists (first paint), then portals the
 * buttons into the toolbar. Place anywhere inside a tab manager's tree.
 */
export function TemplatesActions({ children }: { children: ReactNode }) {
  const slot = useContext(ActionsSlotContext)
  if (!slot) return null
  return createPortal(children, slot)
}
