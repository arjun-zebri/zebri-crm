/**
 * Mapping signature blocks to signers
 * (`app/contract/[token]/_components/contract-parties`).
 *
 * This decides whose signature appears in which slot on a legal document, so
 * the mapping is pinned here rather than checked by eye on a rendered page.
 */
import { describe, expect, it } from 'vitest'

import {
  isViewer,
  partySigner,
  partyState,
  signatureText,
} from '@/app/contract/[token]/_components/contract-parties'
import type {
  ContractSigner,
  PublicContract,
} from '@/app/contract/[token]/_components/public-contract'

const signer = (over: Partial<ContractSigner> & { id: string }): ContractSigner => ({
  role: 'client',
  name: 'Someone',
  signer_name_typed: null,
  signing_order: 1,
  required: true,
  signed_at: null,
  declined_at: null,
  ...over,
})

const contractWith = (
  signers: ContractSigner[],
  viewerId: string | null = null,
): PublicContract => ({ signers, viewer_signer_id: viewerId } as unknown as PublicContract)

const vendor = signer({ id: 'v', role: 'vendor', name: 'Jane MC', signing_order: 0 })
const p1 = signer({ id: 'a', name: 'Sarah', signing_order: 1 })
const p2 = signer({ id: 'b', name: 'James', signing_order: 2 })

describe('partySigner', () => {
  it('resolves each slot from role and signing order', () => {
    const c = contractWith([vendor, p1, p2])
    expect(partySigner(c, 'vendor')?.id).toBe('v')
    expect(partySigner(c, 'primary')?.id).toBe('a')
    expect(partySigner(c, 'secondary')?.id).toBe('b')
  })

  it('orders clients by signing_order regardless of payload order', () => {
    const c = contractWith([p2, p1])
    expect(partySigner(c, 'primary')?.id).toBe('a')
    expect(partySigner(c, 'secondary')?.id).toBe('b')
  })

  it('returns null for a party the contract does not have', () => {
    // A couple with one named contact has no second partner; the panel must
    // render nothing rather than an empty signature line.
    const c = contractWith([vendor, p1])
    expect(partySigner(c, 'secondary')).toBeNull()
  })

  it('returns null for the supplier before the contract is sent', () => {
    expect(partySigner(contractWith([p1]), 'vendor')).toBeNull()
  })

  it('is safe on a null contract', () => {
    expect(partySigner(null, 'primary')).toBeNull()
  })

  it('is the signal the card uses to skip an absent party entirely', () => {
    // The branded card asks the DATA, not the rendered element: the slot
    // returns a component that renders null, which is still truthy, so
    // testing the element left an empty bordered section on the document.
    const oneContact = contractWith([vendor, p1])
    expect(partySigner(oneContact, 'secondary')).toBeNull()
    expect(partySigner(oneContact, 'primary')).not.toBeNull()
    expect(partySigner(oneContact, 'vendor')).not.toBeNull()
  })

  it('never mutates the caller-supplied signers array', () => {
    const signers = [p2, p1]
    partySigner(contractWith(signers), 'primary')
    expect(signers.map((s) => s.id)).toEqual(['b', 'a'])
  })
})

describe('isViewer', () => {
  it('is true only for the signer whose link this is', () => {
    const c = contractWith([vendor, p1, p2], 'a')
    expect(isViewer(c, p1)).toBe(true)
    expect(isViewer(c, p2)).toBe(false)
  })

  it('is false on a legacy link with no viewer', () => {
    expect(isViewer(contractWith([p1], null), p1)).toBe(false)
  })
})

describe('partyState', () => {
  it('reports declined ahead of signed', () => {
    expect(partyState(signer({ id: 'x', signed_at: 't', declined_at: 't' }))).toBe('declined')
  })

  it('reports signed and awaiting', () => {
    expect(partyState(signer({ id: 'x', signed_at: 't' }))).toBe('signed')
    expect(partyState(signer({ id: 'x' }))).toBe('awaiting')
  })
})

describe('signatureText', () => {
  it('prints the name the signer actually typed', () => {
    // The roster name is what the MC entered beforehand; the signature line
    // must show the mark the person made.
    expect(signatureText(signer({ id: 'x', name: 'Sarah', signer_name_typed: 'Sarah E Mitchell' })))
      .toBe('Sarah E Mitchell')
  })

  it('falls back to the roster name before they have signed', () => {
    expect(signatureText(signer({ id: 'x', name: 'Sarah' }))).toBe('Sarah')
  })

  it('ignores a whitespace-only typed name', () => {
    expect(signatureText(signer({ id: 'x', name: 'Sarah', signer_name_typed: '   ' }))).toBe('Sarah')
  })
})
