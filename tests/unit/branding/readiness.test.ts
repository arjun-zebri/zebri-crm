import { describe, it, expect } from 'vitest'
import { evaluateSurface } from '@/lib/branding/readiness'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { SurfaceTab } from '@/types/branding-preview'

describe('readiness', () => {
  it('proposal missing packageTotals raises missing-required issue naming the missing type', () => {
    const blocks: Block[] = [
      { id: '1', type: 'packageHeader' },
      { id: '2', type: 'packageDetails' },
      { id: '3', type: 'action', primary: 'Accept', secondary: null },
    ]
    const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }
    const result = evaluateSurface('proposal', blocks, account)
    expect(result.ready).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('missing-required')
    expect(result.issues[0].message).toContain('Package totals')
  })

  it('invoice with neither paymentDetails nor action raises need-at-least-one issue', () => {
    const blocks: Block[] = [
      { id: '1', type: 'title', title: 'Invoice', subtitle: '', showRef: true, showExpires: false, showAbn: false },
      { id: '2', type: 'lineItems' },
      { id: '3', type: 'totals', taxRate: 0.1, showSubtotal: true },
    ]
    const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }
    const result = evaluateSurface('invoice', blocks, account)
    expect(result.ready).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('need-at-least-one')
  })

  it('invoice with action block but stripeConnected:false raises account issue', () => {
    const blocks: Block[] = [
      { id: '1', type: 'title', title: '', subtitle: '', showRef: false, showExpires: false, showAbn: false },
      { id: '2', type: 'lineItems' },
      { id: '3', type: 'totals', taxRate: 0.1, showSubtotal: true },
      { id: '4', type: 'action', primary: 'Pay now', secondary: null },
    ]
    const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }
    const result = evaluateSurface('invoice', blocks, account)
    expect(result.ready).toBe(true) // Layer A passes
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('account')
    expect(result.issues[0].message).toContain('Connect Stripe to accept card payments')
  })

  it('questionnaire with questionnaireBody lacking mode raises questionnaire-mode issue', () => {
    const blocks: Block[] = [
      { id: '1', type: 'questionnaireBody' },
    ]
    const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }
    const result = evaluateSurface('questionnaire', blocks, account)
    expect(result.ready).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('questionnaire-mode')
  })

  it('fully-seeded proposal with good account is ready with no issues', () => {
    const blocks: Block[] = [
      { id: '1', type: 'packageHeader' },
      { id: '2', type: 'packageDetails' },
      { id: '3', type: 'packageTotals' },
      { id: '4', type: 'action', primary: 'Accept', secondary: null },
    ]
    const account = { stripeConnected: true, bankDetailsFilled: true, contractTemplateExists: true }
    const result = evaluateSurface('proposal', blocks, account)
    expect(result.ready).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('Layer B account issues do not set ready to false', () => {
    const blocks: Block[] = [
      { id: '1', type: 'packageHeader' },
      { id: '2', type: 'packageDetails' },
      { id: '3', type: 'packageTotals' },
      { id: '4', type: 'action', primary: 'Accept', secondary: null },
      { id: '5', type: 'paymentDetails', heading: '', accountName: '', bsb: '', accountNumber: '' },
    ]
    const account = { stripeConnected: true, bankDetailsFilled: false, contractTemplateExists: true }
    const result = evaluateSurface('proposal', blocks, account)
    expect(result.ready).toBe(true) // Layer A passes, Layer B account issues don't flip it
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('account')
    expect(result.issues[0].message).toContain('Add your bank details')
  })
})
