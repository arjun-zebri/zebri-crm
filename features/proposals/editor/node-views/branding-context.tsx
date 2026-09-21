'use client'

/**
 * React context carrying the branding every node view needs for its
 * WYSIWYG render (a button's colour and radius, today). `ContentSectionEditor`
 * wraps `EditorContent` in `ProposalEditorBrandingProvider`; TipTap's
 * `ReactNodeViewRenderer` portals every node view's markup into
 * `EditorContent`'s own subtree, so a node view mounted anywhere in the
 * document sits inside this provider and re-renders on a real branding
 * change, unlike the `editor.storage.proposalEditor` write
 * (`extensions/proposal-editor-storage.ts`), which changes a value
 * nothing subscribes to. That storage write stays as the non-reactive
 * fallback for code that runs outside this provider (a bare test harness
 * that renders a node view without `ContentSectionEditor`).
 *
 * @module features/proposals/editor/node-views/branding-context
 */
import { createContext, useContext, type ReactNode } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

const ProposalEditorBrandingContext = createContext<PublicBranding | null>(null)

/** Wraps `children` (the editor's `EditorContent`) with the current branding, so every node view mounted inside it re-renders when `branding` changes. */
export function ProposalEditorBrandingProvider({ branding, children }: { branding: PublicBranding; children: ReactNode }) {
  return <ProposalEditorBrandingContext.Provider value={branding}>{children}</ProposalEditorBrandingContext.Provider>
}

/** The current branding from the nearest `ProposalEditorBrandingProvider`, or `null` outside one. */
export function useProposalEditorBranding(): PublicBranding | null {
  return useContext(ProposalEditorBrandingContext)
}
