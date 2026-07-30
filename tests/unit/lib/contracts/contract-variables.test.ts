import { describe, expect, it } from 'vitest'

import { buildContractVariables } from '@/lib/contracts/contract-variables'

const base = {
  couple: { name: 'Sam and Alex', email: 'sam@example.com' },
  firstEvent: { date: '2027-03-14', venue: 'The Barn' },
  userMeta: { business_name: 'Zebri MC' },
}

describe('buildContractVariables deposit_amount', () => {
  it('uses the first stage amount', () => {
    const vars = buildContractVariables({
      ...base,
      proposal: { total: 5000 },
      firstStage: { amountCents: 125_000, dueDate: '2026-08-01' },
    })
    expect(vars.deposit_amount).toBe('$1,250.00')
  })

  it('falls back to a dash when there is no schedule at all', () => {
    const vars = buildContractVariables({ ...base, proposal: { total: 5000 }, firstStage: null })
    expect(vars.deposit_amount).toBe('-')
  })

  it('falls back to a dash when there is no money source', () => {
    const vars = buildContractVariables({ ...base, proposal: null, firstStage: null })
    expect(vars.deposit_amount).toBe('-')
    expect(vars.total_amount).toBe('-')
  })
})
