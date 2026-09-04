/**
 * The contract card's block-tree layout
 * (`app/contract/[token]/_components/contract-card-layout`).
 *
 * This decides where a sent contract's terms and signatures appear. Block
 * trees are read live rather than snapshotted per contract, so a rule change
 * here retroactively restructures every contract already in the field; the
 * cases below pin the behaviour that keeps a legacy tree rendering exactly as
 * its signatories saw it.
 */
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import {
  layoutContractCard,
  signModeFor,
} from '@/app/contract/[token]/_components/contract-card-layout'

const block = (type: string, id = type): Block => ({ id, type } as unknown as Block)

const body = block('contractBody', 'cb')
const legacySign = block('contractSign', 'cs')
const vendor = block('contractSignVendor', 'csv')
const primary = block('contractSignPrimary', 'csp')
const secondary = block('contractSignSecondary', 'css')
const text = block('text', 'tx')
const title = block('title', 'tt')

describe('signModeFor', () => {
  it('is per-party when any party marker is present', () => {
    expect(signModeFor([body, primary])).toBe('per-party')
    expect(signModeFor([body, vendor])).toBe('per-party')
    expect(signModeFor([body, secondary])).toBe('per-party')
  })

  it('is legacy for a tree that still has the all-in-one block', () => {
    expect(signModeFor([body, legacySign])).toBe('legacy')
  })

  it('prefers per-party when a tree somehow has both', () => {
    // Mid-upgrade state. Rendering both would print every signature twice.
    expect(signModeFor([body, legacySign, primary])).toBe('per-party')
  })

  it('is none when a tree has no signature marker at all', () => {
    expect(signModeFor([title, body])).toBe('none')
  })

  it('forces legacy when the contract has no signer rows', () => {
    // Contracts predating `contract_signers` carry their signature in the
    // denormalised columns only. Per-party panels resolve from the signer
    // rows, so honouring the blocks here would print a blank signature page.
    expect(signModeFor([body, vendor, primary], false)).toBe('legacy')
  })
})

describe('layoutContractCard', () => {
  it('injects the body and one node per party, in tree order', () => {
    const nodes = layoutContractCard([title, body, vendor, primary, secondary])
    expect(nodes.map((n) => n.kind)).toEqual([
      'chrome',
      'body',
      'sign-party',
      'sign-party',
      'sign-party',
    ])
    expect(nodes.filter((n) => n.kind === 'sign-party').map((n) => n.party)).toEqual([
      'vendor',
      'primary',
      'secondary',
    ])
  })

  it('groups consecutive chrome blocks into one run', () => {
    const nodes = layoutContractCard([title, text, body, primary])
    expect(nodes[0]).toEqual({ kind: 'chrome', blocks: [title, text] })
  })

  it('honours chrome placed between signature panels', () => {
    const nodes = layoutContractCard([body, primary, text, secondary])
    expect(nodes.map((n) => n.kind)).toEqual(['body', 'sign-party', 'chrome', 'sign-party'])
  })

  it('renders a legacy tree through the single stacked section, untouched', () => {
    const nodes = layoutContractCard([title, body, legacySign])
    expect(nodes.map((n) => n.kind)).toEqual(['chrome', 'body', 'sign-legacy'])
  })

  it('drops a stray legacy marker once per-party blocks exist', () => {
    // Otherwise the MC countersignature would render twice: once in the old
    // stacked section and once in the vendor panel.
    const nodes = layoutContractCard([body, legacySign, vendor, primary])
    expect(nodes.filter((n) => n.kind === 'sign-legacy')).toHaveLength(0)
    expect(nodes.filter((n) => n.kind === 'sign-party')).toHaveLength(2)
  })

  it('marks only the first signature panel as first', () => {
    // The document-level status banner renders once, at that node.
    const nodes = layoutContractCard([body, vendor, primary, secondary])
    const parties = nodes.filter((n) => n.kind === 'sign-party')
    expect(parties.map((n) => (n.kind === 'sign-party' ? n.first : null))).toEqual([
      true,
      false,
      false,
    ])
  })

  it('always emits a body node, even for a tree with no body marker', () => {
    // A contract that cannot show its own terms is the one failure worth
    // being defensive about.
    const nodes = layoutContractCard([title, primary])
    expect(nodes.some((n) => n.kind === 'body')).toBe(true)
  })

  it('always emits a signature node, even for a tree with no sign marker', () => {
    // Likewise: branding arrangement must never make a contract unsignable.
    const nodes = layoutContractCard([title, body])
    expect(nodes.some((n) => n.kind === 'sign-legacy')).toBe(true)
  })

  it('renders the legacy section at the first party marker when there are no signers', () => {
    // The signature still lands where the MC placed it, rather than being
    // appended at the end by the safety net.
    const nodes = layoutContractCard([body, vendor, primary, text], false)
    expect(nodes.map((n) => n.kind)).toEqual(['body', 'sign-legacy', 'chrome'])
  })

  it('never emits an empty signature section when there are no signers', () => {
    const nodes = layoutContractCard([body, vendor, primary, secondary], false)
    expect(nodes.filter((n) => n.kind === 'sign-party')).toHaveLength(0)
    expect(nodes.filter((n) => n.kind === 'sign-legacy')).toHaveLength(1)
  })

  it('handles a completely empty tree', () => {
    expect(layoutContractCard([]).map((n) => n.kind)).toEqual(['body', 'sign-legacy'])
  })
})
