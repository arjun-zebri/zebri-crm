import { describe, expect, it } from 'vitest'

import { CONTRACT_VARIABLES, buildContractVariables } from '@/lib/contracts/contract-variables'

const base = {
  couple: { name: 'Sam and Alex', email: 'sam@example.com' },
  firstEvent: { date: '2027-03-14', venue: 'The Barn' },
  userMeta: { business_name: 'Zebri MC' },
}

describe('contract variables after proposal removal', () => {
  it('offers exactly the seven surviving variables', () => {
    expect(CONTRACT_VARIABLES.map((v) => v.id)).toEqual([
      'couple_name',
      'couple_email',
      'event_date',
      'venue',
      'mc_business_name',
      'mc_signature_name',
      'today',
    ])
  })

  it('builds values from the couple, event, and MC settings only', () => {
    const vars = buildContractVariables(base)
    expect(vars.couple_name).toBe('Sam and Alex')
    expect(vars.couple_email).toBe('sam@example.com')
    expect(vars.venue).toBe('The Barn')
    expect(vars.mc_business_name).toBe('Zebri MC')
  })

  it('no longer exposes proposal-derived money variables', () => {
    const vars = buildContractVariables(base)
    expect(vars).not.toHaveProperty('total_amount')
    expect(vars).not.toHaveProperty('deposit_amount')
  })

  it('renders a dash for missing couple/event fields', () => {
    const vars = buildContractVariables({
      couple: { name: '', email: null },
      firstEvent: null,
      userMeta: {},
    })
    expect(vars.couple_name).toBe('-')
    expect(vars.couple_email).toBe('-')
    expect(vars.event_date).toBe('-')
    expect(vars.venue).toBe('-')
    expect(vars.mc_business_name).toBe('-')
  })
})
