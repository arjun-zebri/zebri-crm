/**
 * Grouping contract signers into email recipients
 * (`lib/contracts/signer-recipients`).
 *
 * This exists because of a live bug: both the send route and the reminder
 * cron de-duplicated recipients by email address. When both partners share an
 * inbox (common), the second partner's personal sign link was dropped from the
 * initial send AND from every reminder round, so they could never sign and the
 * contract could never reach `signed`.
 *
 * The cases below pin the fix: one email per mailbox, every signer's own token
 * still delivered.
 */
import { describe, expect, it } from 'vitest'

import { groupRecipientsByAddress } from '@/lib/contracts/signer-recipients'

const urlFor = (token: string) => `https://app.test/contract/${token}`

describe('groupRecipientsByAddress', () => {
  it('keeps separate addresses as separate emails', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: 'sarah@example.com', name: 'Sarah', token: 'tok-a' },
        { email: 'james@example.com', name: 'James', token: 'tok-b' },
      ],
      urlFor,
    )

    expect(groups).toHaveLength(2)
    expect(groups[0]?.name).toBe('Sarah')
    expect(groups[0]?.links).toEqual([
      { name: 'Sarah', url: 'https://app.test/contract/tok-a' },
    ])
    expect(groups[1]?.links).toEqual([
      { name: 'James', url: 'https://app.test/contract/tok-b' },
    ])
  })

  it('carries BOTH tokens when partners share one inbox', () => {
    // The regression this module exists to prevent: partner 2's token must
    // survive into the single email sent to the shared address.
    const groups = groupRecipientsByAddress(
      [
        { email: 'thehappycouple@example.com', name: 'Sarah', token: 'tok-a' },
        { email: 'thehappycouple@example.com', name: 'James', token: 'tok-b' },
      ],
      urlFor,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.links).toEqual([
      { name: 'Sarah', url: 'https://app.test/contract/tok-a' },
      { name: 'James', url: 'https://app.test/contract/tok-b' },
    ])
  })

  it('greets a shared inbox with both names', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: 'both@example.com', name: 'Sarah', token: 'a' },
        { email: 'both@example.com', name: 'James', token: 'b' },
      ],
      urlFor,
    )
    expect(groups[0]?.name).toBe('Sarah and James')
  })

  it('joins three names with commas and a final "and"', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: 'all@example.com', name: 'Sarah', token: 'a' },
        { email: 'all@example.com', name: 'James', token: 'b' },
        { email: 'all@example.com', name: 'Alex', token: 'c' },
      ],
      urlFor,
    )
    expect(groups[0]?.name).toBe('Sarah, James and Alex')
  })

  it('treats addresses case-insensitively but keeps the first-seen casing', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: 'Both@Example.com', name: 'Sarah', token: 'a' },
        { email: 'both@example.com', name: 'James', token: 'b' },
      ],
      urlFor,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.email).toBe('Both@Example.com')
    expect(groups[0]?.links).toHaveLength(2)
  })

  it('skips signers with no address on file', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: null, name: 'No Email', token: 'a' },
        { email: 'sarah@example.com', name: 'Sarah', token: 'b' },
      ],
      urlFor,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.name).toBe('Sarah')
  })

  it('returns nothing when no signer has an address', () => {
    expect(groupRecipientsByAddress([{ email: null, name: 'X', token: 'a' }], urlFor)).toEqual([])
  })

  it('uses the first signer at an address as the single-CTA fallback token', () => {
    const groups = groupRecipientsByAddress(
      [
        { email: 'both@example.com', name: 'Sarah', token: 'first' },
        { email: 'both@example.com', name: 'James', token: 'second' },
      ],
      urlFor,
    )
    expect(groups[0]?.token).toBe('first')
  })
})
