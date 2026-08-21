/**
 * Tests for deriving the questionnaire answer style from branding blocks.
 */
import { describe, it, expect } from 'vitest'

import { displayModeFromBlocks, displayModeLabel } from '@/lib/questionnaires/display-mode'

describe('displayModeFromBlocks', () => {
  it('returns typeform when the one-at-a-time marker is present', () => {
    expect(displayModeFromBlocks([{ type: 'questionnaireOneAtATime' }])).toBe('typeform')
  })

  it('returns form when the all-on-one-page marker is present', () => {
    expect(displayModeFromBlocks([{ type: 'questionnaireAllOnePage' }])).toBe('form')
  })

  it('falls back to form when no marker is present', () => {
    expect(displayModeFromBlocks([{ type: 'businessName' }, { type: 'divider' }])).toBe('form')
  })

  it('falls back to form on an empty tree', () => {
    expect(displayModeFromBlocks([])).toBe('form')
  })

  it('lets the first marker win when both are present', () => {
    expect(
      displayModeFromBlocks([
        { type: 'questionnaireOneAtATime' },
        { type: 'questionnaireAllOnePage' },
      ]),
    ).toBe('typeform')
    expect(
      displayModeFromBlocks([
        { type: 'questionnaireAllOnePage' },
        { type: 'questionnaireOneAtATime' },
      ]),
    ).toBe('form')
  })

  it('ignores markers nested elsewhere in the object', () => {
    expect(displayModeFromBlocks([{ type: 'text' }])).toBe('form')
  })
})

describe('displayModeLabel', () => {
  it('describes each style the way the MC reads it', () => {
    expect(displayModeLabel('typeform')).toBe('one at a time')
    expect(displayModeLabel('form')).toBe('all on one page')
  })
})
