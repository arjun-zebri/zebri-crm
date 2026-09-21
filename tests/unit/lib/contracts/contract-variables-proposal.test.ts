import { describe, expect, it } from 'vitest'

import { buildContractVariables, CONTRACT_VARIABLES } from '@/lib/contracts/contract-variables'

const base = { couple: { name: 'Anna & Jake', email: 'a@example.com' }, firstEvent: null, userMeta: {} }

describe('proposal contract variables', () => {
  it('are in the catalogue', () => {
    const ids = CONTRACT_VARIABLES.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining(['package_name', 'total_amount', 'deposit_amount']))
  })
  it('resolve from the accepted proposal', () => {
    const vars = buildContractVariables({ ...base, proposal: { packageName: 'Full Day MC', total: 2400, deposit: 600 } })
    expect(vars.package_name).toBe('Full Day MC')
    expect(vars.total_amount).toBe('$2,400.00')
    expect(vars.deposit_amount).toBe('$600.00')
  })
  it('fall back to the dash on a manual contract', () => {
    const vars = buildContractVariables(base)
    expect(vars.package_name).toBe('-')
    expect(vars.total_amount).toBe('-')
    expect(vars.deposit_amount).toBe('-')
  })
})
