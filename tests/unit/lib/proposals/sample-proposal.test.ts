import { describe, expect, it } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { sampleProposal, SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

describe('sampleProposal', () => {
  const proposal = sampleProposal(buildPublicBranding({}))

  it('has two options ordered by position, the second is_popular', () => {
    expect(proposal.options).toHaveLength(2)
    expect(proposal.options[0]?.position).toBe(0)
    expect(proposal.options[1]?.position).toBe(1)
    expect(proposal.options[0]?.is_popular).toBe(false)
    expect(proposal.options[1]?.is_popular).toBe(true)
  })

  it('each option has at least one required item and one add-on item', () => {
    for (const option of proposal.options) {
      expect(option.items.some((i) => !i.is_addon)).toBe(true)
      expect(option.items.some((i) => i.is_addon)).toBe(true)
    }
  })

  it('intro_note is a TipTap doc mentioning couple_name via a variable node', () => {
    const json = JSON.stringify(proposal.intro_note)
    expect(proposal.intro_note?.type).toBe('doc')
    expect(json).toContain('"type":"variable"')
    expect(json).toContain('"id":"couple_name"')
  })

  it('has a 25% deposit, is not expired, and is sent', () => {
    expect(proposal.deposit_percent).toBe(25)
    expect(proposal.expired).toBe(false)
    expect(proposal.status).toBe('sent')
  })

  it('SAMPLE_PROPOSAL_DOC is open', () => {
    expect(SAMPLE_PROPOSAL_DOC.proposal?.state).toBe('open')
  })
})
