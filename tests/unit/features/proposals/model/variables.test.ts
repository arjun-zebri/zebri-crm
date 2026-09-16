/**
 * Variables in a v2 rich doc resolve through the same table the v1 chips
 * use, so a migrated `{{ couple_name }}` keeps working and the public page
 * never shows a raw chip.
 *
 * @module tests/unit/features/proposals/model/variables
 */
import { describe, expect, it } from 'vitest'

import { isProposalVariable, PROPOSAL_VARIABLES, resolveProposalVariables } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

describe('proposal variables', () => {
  it('knows the proposal surface ids and nothing else', () => {
    expect(PROPOSAL_VARIABLES.map((v) => v.id)).toEqual(expect.arrayContaining(['couple_name', 'event_date', 'venue', 'business_name', 'proposal_number', 'expiry_date', 'deposit_percent']))
    expect(isProposalVariable('couple_name')).toBe(true)
    expect(isProposalVariable('invoice_number')).toBe(false)
  })

  it('resolves every proposal id to a string for the sample doc', () => {
    const values = resolveProposalVariables(buildPublicBranding({ business_name: 'Sam MC' }), SAMPLE_PROPOSAL_DOC)
    for (const v of PROPOSAL_VARIABLES) expect(typeof values[v.id]).toBe('string')
    expect(values.business_name).toBe('Sam MC')
    expect(values.couple_name).toBe(SAMPLE_PROPOSAL_DOC.coupleName)
  })
})
