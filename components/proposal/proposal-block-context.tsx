/**
 * React context carrying the proposal block state (selected option, add-on
 * selection, handlers, branding, state) so proposal-specific blocks can
 * render consistently without thread-passing.
 *
 * @module components/proposal/proposal-block-context
 */
'use client'

import { createContext, ReactNode, useContext } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

/**
 * The proposal block context carries the state and handlers all
 * proposal-specific blocks need. Initialized by {@link ProposalBlocksRenderer}.
 */
export interface ProposalBlockContextValue {
  options: PublicProposalOption[]
  chosenId: string
  selection: Record<string, boolean>
  onChoose?: (optionId: string) => void
  onToggle?: (itemId: string, next: boolean) => void
  branding: PublicBranding
  view: ProposalViewBranding
  expiresAt: string | null
  state: 'active' | 'accepted' | 'declined' | 'expired'
}

const ProposalBlockContext = createContext<ProposalBlockContextValue | undefined>(undefined)

/**
 * Hook to access the proposal block context. Throws if used outside
 * {@link ProposalBlocksRenderer}.
 *
 * @throws If context is not available (component is rendered outside the provider).
 */
export function useProposalBlock(): ProposalBlockContextValue {
  const context = useContext(ProposalBlockContext)
  if (!context) {
    throw new Error('useProposalBlock must be used within ProposalBlocksRenderer')
  }
  return context
}

/**
 * Context provider for proposal block rendering. Wraps the proposal
 * block tree with the state all sub-components need.
 */
export function ProposalBlockProvider({
  value,
  children,
}: {
  value: ProposalBlockContextValue
  children: ReactNode
}) {
  return (
    <ProposalBlockContext.Provider value={value}>{children}</ProposalBlockContext.Provider>
  )
}
