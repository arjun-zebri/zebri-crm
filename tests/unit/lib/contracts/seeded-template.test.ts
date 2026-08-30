/**
 * Guards the SQL-seeded default contract template against merge-field drift.
 *
 * The template lives in a migration, the variable catalog lives in TypeScript,
 * and nothing connected the two, so `total_amount` / `deposit_amount` mentions
 * survived in the seeded template long after the variables backing them were
 * removed with the quotes and proposals features. Every contract sent from the
 * default template rendered the literal "{{total_amount}}" in its fee clause.
 *
 * This test reads whichever migration most recently defines
 * `seed_default_contract_template` and asserts its body resolves cleanly.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import {
  buildContractVariables,
  findUnknownVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables'

const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations')
const DEFINES = 'create or replace function seed_default_contract_template'

/** The live seeded template: the last migration that redefines the seeder wins. */
function loadSeededTemplate(): JSONContent {
  const file = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .find((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8').includes(DEFINES))

  if (!file) throw new Error('no migration defines seed_default_contract_template')

  const sql = readFileSync(path.join(MIGRATIONS, file), 'utf8')
  const start = sql.indexOf('$template$', sql.indexOf(DEFINES))
  const end = sql.indexOf('$template$', start + '$template$'.length)
  return JSON.parse(sql.slice(start + '$template$'.length, end)) as JSONContent
}

describe('seeded default contract template', () => {
  const template = loadSeededTemplate()

  it('only uses merge fields the resolver can actually resolve', () => {
    expect(findUnknownVariables(template)).toEqual([])
  })

  it('renders with no unsubstituted tokens left in the document', () => {
    const html = renderContractHtml(
      template,
      buildContractVariables({
        couple: { name: 'Sam and Alex', email: 'sam@example.com' },
        firstEvent: { date: '2027-03-14', venue: 'The Barn' },
        userMeta: { business_name: 'Zebri MC' },
      }),
    )
    expect(html).not.toContain('{{')
    // Sanity: the substitution really did run.
    expect(html).toContain('Sam and Alex')
  })

  it('starts at its first clause, with no heading of its own', () => {
    // The Contract header block in Branding owns the document heading; an h1
    // here would print a second one directly under it.
    const first = (template.content ?? [])[0]
    expect(first?.type === 'heading' && first?.attrs?.level === 1).toBe(false)
  })

  it('does not reference the removed quotes feature', () => {
    expect(JSON.stringify(template)).not.toContain('accompanying quote')
  })

  const render = (userMeta: Record<string, unknown>) =>
    renderContractHtml(
      template,
      buildContractVariables({
        couple: { name: 'Sam and Alex', email: 'sam@example.com' },
        firstEvent: { date: '2027-03-14', venue: 'The Barn' },
        userMeta: { business_name: 'Zebri', ...userMeta },
      }),
    )

  it('calls a DJ a DJ, not an MC', () => {
    const html = render({ business_type: ['dj'] })
    expect(html).toContain('the DJ')
    expect(html).not.toMatch(/\bMC\b/)
  })

  it('still calls an MC an MC', () => {
    expect(render({ business_type: ['mc'] })).toContain('the MC')
  })

  it('honours a free-text role override', () => {
    expect(render({ business_type: ['dj'], vendor_role: 'Celebrant & Host' })).toContain(
      'the Celebrant &amp; Host',
    )
  })

  it('hard-codes no role of its own', () => {
    // The stored body must carry no literal role noun: every one is a token.
    expect(JSON.stringify(template)).not.toMatch(/\bMC\b/)
  })
})
