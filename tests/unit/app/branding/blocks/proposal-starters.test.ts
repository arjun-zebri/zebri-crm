import { describe, expect, it } from 'vitest'

import { proposalNeutralBlocks, proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import { evaluateSurface } from '@/lib/branding/readiness'
import type { ProposalRole } from '@/lib/proposals/types'

const ROLES: ProposalRole[] = ['mc', 'celebrant', 'both']
const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }

describe('proposalStarterBlocks', () => {
  it.each(ROLES)('%s tree carries exactly one hero, introNote, packages, accept in that order', (role) => {
    const types = proposalStarterBlocks(role).map((b) => b.type)
    for (const t of ['hero', 'introNote', 'packages', 'accept']) {
      expect(types.filter((x) => x === t)).toHaveLength(1)
    }
    expect(types.indexOf('hero')).toBeLessThan(types.indexOf('introNote'))
    expect(types.indexOf('introNote')).toBeLessThan(types.indexOf('packages'))
    expect(types.indexOf('packages')).toBeLessThan(types.indexOf('accept'))
  })

  it('gives every block a unique id and role-specific copy', () => {
    const mc = proposalStarterBlocks('mc')
    const cel = proposalStarterBlocks('celebrant')
    expect(new Set(mc.map((b) => b.id)).size).toBe(mc.length)
    const mcSteps = mc.find((b) => b.type === 'howItWorks')
    const celSteps = cel.find((b) => b.type === 'howItWorks')
    expect(mcSteps?.type === 'howItWorks' && mcSteps.steps.map((s) => String(s.title)).join()).toMatch(/run sheet/i)
    expect(celSteps?.type === 'howItWorks' && celSteps.steps.map((s) => String(s.title) + String(s.description)).join()).toMatch(/NOIM|ceremony/i)
  })

  it('never contains an em dash', () => {
    for (const role of ROLES) {
      expect(JSON.stringify(proposalStarterBlocks(role))).not.toContain("\u2014")
    }
  })

  it('no starter tree ships a testimonial item (MC opts in per quote)', () => {
    for (const role of ROLES) {
      const testimonials = proposalStarterBlocks(role).find((b) => b.type === 'testimonials')
      expect(testimonials?.type === 'testimonials' && testimonials.items).toEqual([])
    }
  })
})

describe('proposalNeutralBlocks', () => {
  it('contains exactly hero, introNote, packages, accept and footer, in that order', () => {
    expect(proposalNeutralBlocks().map((b) => b.type)).toEqual(['hero', 'introNote', 'packages', 'accept', 'footer'])
  })

  it('carries no testimonials, aboutMe, howItWorks or faq block', () => {
    const types = new Set(proposalNeutralBlocks().map((b) => b.type))
    for (const t of ['testimonials', 'aboutMe', 'howItWorks', 'faq'] as const) {
      expect(types.has(t)).toBe(false)
    }
  })

  it('passes proposal readiness', () => {
    expect(evaluateSurface('proposal', proposalNeutralBlocks(), account).ready).toBe(true)
  })

  it('gives every block a unique id', () => {
    const tree = proposalNeutralBlocks()
    expect(new Set(tree.map((b) => b.id)).size).toBe(tree.length)
  })
})
