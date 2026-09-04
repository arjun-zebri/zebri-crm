import { describe, it, expect } from 'vitest'

import { defaultBlocksFor, blockTemplate, migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'

const types = (bs: { type: string }[]) => bs.map((b) => b.type)

describe('defaultBlocksFor', () => {
  it('invoice seeds both bank details and pay CTA', () => {
    const t = types(defaultBlocksFor('invoice'))
    expect(t).toContain('paymentDetails')
    expect(t).toContain('action')
    expect(t[0]).toBe('businessName')
    expect(t[t.length - 1]).toBe('footer')
  })

  it('questionnaire seeds the all-on-one-page form (a valid exactly-one state)', () => {
    const blocks = defaultBlocksFor('questionnaire')
    const t = types(blocks)
    expect(t).toContain('questionnaireAllOnePage')
    expect(t).not.toContain('questionnaireOneAtATime')
    const form = blocks.find((b) => b.type === 'questionnaireAllOnePage')
    expect(form).toMatchObject({ type: 'questionnaireAllOnePage', locked: true })
  })

  it('blockTemplate builds each document-specific block', () => {
    for (const t of ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'contractSign'] as const) {
      expect(blockTemplate(t)).toMatchObject({ type: t })
    }
    // The sign marker is a locked singleton.
    expect(blockTemplate('contractSign')).toMatchObject({ type: 'contractSign', locked: true })
  })

  it('contract default seeds a header (ref + ABN on, expires off), the body marker, then one signature panel per party, no CTA', () => {
    const blocks = defaultBlocksFor('contract')
    const t = types(blocks)
    expect(t).toEqual([
      'businessName',
      'title',
      'contractBody',
      // A signature page reads in this order: the supplier has already signed
      // by sending, then each partner.
      'contractSignVendor',
      'contractSignPrimary',
      'contractSignSecondary',
    ])
    expect(t).not.toContain('action')
    // New trees never seed the deprecated all-in-one block.
    expect(t).not.toContain('contractSign')
    // The signature panels come after the body marker.
    expect(t.indexOf('contractSignVendor')).toBeGreaterThan(t.indexOf('contractBody'))
    const header = blocks.find((b) => b.type === 'title')
    // Ref and ABN identify the document and the supplier as a legal party, so
    // an agreement carries both. Expiry stays off: `contracts.expires_at` is a
    // signing deadline, not a term, and "Expires" reads as the agreement
    // lapsing.
    expect(header).toMatchObject({
      type: 'title',
      showRef: true,
      showAbn: true,
      showExpires: false,
    })
    const body = blocks.find((b) => b.type === 'contractBody')
    expect(body).toMatchObject({ type: 'contractBody', locked: true })
    // Each panel is locked so it cannot be duplicated (two "partner 1" slots
    // would print the same signature twice), while staying deletable and
    // re-addable from the palette like every other clearable marker.
    for (const type of [
      'contractSignVendor',
      'contractSignPrimary',
      'contractSignSecondary',
    ] as const) {
      expect(blocks.find((b) => b.type === type)).toMatchObject({ type, locked: true })
    }
  })

  it('drops a stray all-in-one sign block once per-party panels exist', () => {
    // Only fires after the MC explicitly adds a per-party block, at which point
    // the old block has already stopped rendering; leaving it would show a
    // block in the editor that does nothing on the document.
    const migrated = migrateBlocks(
      [
        { id: 'cb', type: 'contractBody', locked: true },
        { id: 'cs', type: 'contractSign', locked: true },
        { id: 'csp', type: 'contractSignPrimary', locked: true },
      ],
      'contract',
    )
    expect(types(migrated)).toEqual(['contractBody', 'contractSignPrimary'])
  })

  it('leaves an untouched legacy tree alone', () => {
    // The guarantee: no already-sent contract changes shape without an
    // explicit MC action.
    const migrated = migrateBlocks(
      [
        { id: 'cb', type: 'contractBody', locked: true },
        { id: 'cs', type: 'contractSign', locked: true },
      ],
      'contract',
    )
    expect(types(migrated)).toEqual(['contractBody', 'contractSign'])
  })

  it('migrates a legacy questionnaireBody block by its mode, preserving id + styling', () => {
    const oneAtATime = migrateBlocks(
      [{ id: 'qb-1', type: 'questionnaireBody', mode: 'oneAtATime', locked: true, bgColor: '#EEE', padTop: 12 }],
      'questionnaire',
    )
    expect(oneAtATime[0]).toMatchObject({
      id: 'qb-1',
      type: 'questionnaireOneAtATime',
      locked: true,
      bgColor: '#EEE',
      padTop: 12,
    })
    // The now-meaningless mode field is dropped.
    expect('mode' in oneAtATime[0]!).toBe(false)

    // 'form' and an absent mode both map to the all-on-one-page form.
    const form = migrateBlocks([{ id: 'qb-2', type: 'questionnaireBody', mode: 'form' }], 'questionnaire')
    expect(form[0]).toMatchObject({ id: 'qb-2', type: 'questionnaireAllOnePage' })
    const noMode = migrateBlocks([{ id: 'qb-3', type: 'questionnaireBody' }], 'questionnaire')
    expect(noMode[0]).toMatchObject({ id: 'qb-3', type: 'questionnaireAllOnePage' })
  })

  it('title template is surface-aware: contract turns Expires + Ref off, invoice keeps them on', () => {
    // Ref and ABN identify the document and the supplier as a legal party, so
    // both belong on an agreement. Expiry stays off: `contracts.expires_at` is
    // a signing deadline, not a term.
    expect(blockTemplate('title', 'contract')).toMatchObject({
      showRef: true,
      showAbn: true,
      showExpires: false,
    })
    expect(blockTemplate('title', 'invoice')).toMatchObject({ showExpires: true, showRef: true })
    // No surface passed → the generic default (Expires + Ref on).
    expect(blockTemplate('title')).toMatchObject({ showExpires: true, showRef: true })
  })
})
