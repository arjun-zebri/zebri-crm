import { describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'

describe('runSql', () => {
  it('runs a statement against the local database and returns its output', () => {
    expect(runSql('select 1 + 1')).toBe('2')
  })

  it('throws on a SQL error rather than returning empty output', () => {
    expect(() => runSql('select * from table_that_does_not_exist')).toThrow(/does not exist/)
  })
})
