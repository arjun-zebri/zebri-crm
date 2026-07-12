import { describe, expect, it } from 'vitest'

import { resolveProposalLabels } from '@/lib/branding/proposal-labels'

describe('resolveProposalLabels back-compat', () => {
  it('reads the legacy string form', () => {
    const r = resolveProposalLabels({ accept: 'Book us' })
    expect(r.accept.text).toBe('Book us')
    expect(r.accept.style).toBeUndefined()
  })

  it('reads the new styled form', () => {
    const r = resolveProposalLabels({
      accept: { text: 'Book us', style: { textTransform: 'uppercase' } },
    })
    expect(r.accept.text).toBe('Book us')
    expect(r.accept.style?.textTransform).toBe('uppercase')
  })

  it('falls back to defaults for blanks', () => {
    const r = resolveProposalLabels({})
    expect(r.accept.text).toBeTruthy()
    expect(r.eyebrow.text).toBeTruthy()
  })

  it('handles partial overrides with styled labels', () => {
    const r = resolveProposalLabels({
      accept: { text: 'Accept now' },
      note: 'Custom note',
    })
    expect(r.accept.text).toBe('Accept now')
    expect(r.accept.style).toBeUndefined()
    expect(r.note.text).toBe('Custom note')
    expect(r.note.style).toBeUndefined()
  })

  it('normalizes whitespace-only text to defaults', () => {
    const r = resolveProposalLabels({ accept: '   ' })
    expect(r.accept.text).toBe(resolveProposalLabels({}).accept.text)
  })
})
