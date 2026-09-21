import { describe, expect, it } from 'vitest'

import { paletteGroupsForSurface } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { atMostOneForSurface, exactlyOneForSurface, isDeletable, isMarker, requiredTypesForSurface } from '@/app/(dashboard)/branding/blocks/policy'
import { VARIABLES_BY_SURFACE } from '@/lib/branding/document-variables'
import { evaluateSurface } from '@/lib/branding/readiness'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }

describe('proposal surface policy', () => {
  it('requires only the accept CTA, and caps the hero at one without requiring it', () => {
    expect(requiredTypesForSurface('proposal')).toEqual(['accept'])
    expect(exactlyOneForSurface('proposal')).toBeNull()
    expect(atMostOneForSurface('proposal')).toEqual(['hero'])
  })

  it('a tree with nothing but an accept block is ready to send', () => {
    const accept = defaultBlocksFor('proposal').find((b) => b.type === 'accept')!
    expect(evaluateSurface('proposal', [accept], account).ready).toBe(true)
  })

  it('dropping the hero, note or packages block leaves the tree ready', () => {
    const tree = defaultBlocksFor('proposal')
    for (const t of ['hero', 'introNote', 'packages'] as const) {
      expect(evaluateSurface('proposal', tree.filter((b) => b.type !== t), account).ready).toBe(true)
    }
  })

  it('a missing hero raises no issue at all, so it is never listed twice', () => {
    const tree = defaultBlocksFor('proposal').filter((b) => b.type !== 'hero')
    const { issues } = evaluateSurface('proposal', tree, account)
    expect(issues.filter((i) => i.message.toLowerCase().includes('hero'))).toEqual([])
  })
  it('the three data-bound blocks are clearable markers; hero is not a marker', () => {
    for (const t of ['introNote', 'packages', 'accept'] as const) expect(isMarker(t)).toBe(true)
    expect(isMarker('hero')).toBe(false)
    const packages = defaultBlocksFor('proposal').find((b) => b.type === 'packages')!
    expect(isDeletable(packages, 'proposal')).toBe(true)
  })
  it('the default tree is ready', () => {
    expect(evaluateSurface('proposal', defaultBlocksFor('proposal'), account).ready).toBe(true)
  })
  it('the default tree is the role-neutral starter: no about-me/how-it-works/faq/testimonials block', () => {
    const types = new Set(defaultBlocksFor('proposal').map((b) => b.type))
    for (const t of ['aboutMe', 'howItWorks', 'faq', 'testimonials'] as const) {
      expect(types.has(t)).toBe(false)
    }
  })
  it('two heroes still reads as one issue, not two', () => {
    const tree = defaultBlocksFor('proposal')
    const hero = tree.find((b) => b.type === 'hero')!
    const { issues } = evaluateSurface('proposal', [...tree, { ...hero, id: 'hero-2' }], account)
    expect(issues.filter((i) => i.message.toLowerCase().includes('hero')).map((i) => i.message)).toEqual(['Only one Hero'])
  })
  it('two heroes or a missing accept is not ready', () => {
    const tree = defaultBlocksFor('proposal')
    const hero = tree.find((b) => b.type === 'hero')!
    expect(evaluateSurface('proposal', [...tree, { ...hero, id: 'hero-2' }], account).ready).toBe(false)
    expect(evaluateSurface('proposal', tree.filter((b) => b.type !== 'accept'), account).ready).toBe(false)
  })
  it('repairBlocks dedupes a second packages marker', () => {
    const tree = defaultBlocksFor('proposal')
    const pk = tree.find((b) => b.type === 'packages')!
    expect(repairBlocks('proposal', [...tree, { ...pk, id: 'pk-2' }]).filter((b) => b.type === 'packages')).toHaveLength(1)
  })
  it('the palette lists the ten proposal blocks under Document-specific', () => {
    const doc = paletteGroupsForSurface('proposal').find((g) => g.label === 'Document-specific')!
    expect(doc.entries.map((e) => e.type)).toEqual(['hero', 'introNote', 'aboutMe', 'howItWorks', 'packages', 'video', 'gallery', 'testimonials', 'faq', 'accept'])
  })
  it('offers couple, proposal and business variables', () => {
    const ids = VARIABLES_BY_SURFACE.proposal.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining(['couple_name', 'event_date', 'venue', 'proposal_number', 'expiry_date', 'deposit_percent', 'business_name']))
    expect(ids).not.toContain('mc_name')
  })
})
