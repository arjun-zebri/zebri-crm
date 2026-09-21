/**
 * Variables a proposal rich doc may reference (spec §2.2). Reuses the
 * proposal surface's definitions and resolver from `lib/branding` so v1
 * chips migrate unchanged and there is one source of truth for what
 * `{{ couple_name }}` means.
 *
 * @module features/proposals/model/variables
 */
import { VARIABLES_BY_SURFACE, type DocumentVariable } from '@/lib/branding/document-variables'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { buildVariableValues } from '@/lib/branding/public-blocks/variable-values'
import type { PublicBranding } from '@/lib/branding/public-branding'

/** The variables the editor offers and the renderer resolves on a proposal. */
export const PROPOSAL_VARIABLES: readonly DocumentVariable[] = VARIABLES_BY_SURFACE.proposal

const IDS = new Set(PROPOSAL_VARIABLES.map((v) => v.id))

/** True for an id the proposal surface defines; unknown ids render as empty text. */
export function isProposalVariable(id: string): boolean {
  return IDS.has(id)
}

/** Every proposal variable id mapped to its display value for this proposal. */
export function resolveProposalVariables(branding: PublicBranding, doc: PublicDocData): Record<string, string> {
  const all = buildVariableValues(branding, doc)
  const out: Record<string, string> = {}
  for (const v of PROPOSAL_VARIABLES) out[v.id] = all[v.id] ?? ''
  return out
}
