/**
 * The layout editor's local draft (`editor/local-draft.ts`): every
 * layout change is mirrored into `localStorage` keyed by user + kind + id,
 * and on load the draft is reconciled against the server row so a refresh
 * inside the autosave window, a failed save, or a closed tab never loses
 * work (2026-09-20 "lost on refresh" root cause).
 *
 * @module tests/unit/features/proposals/editor/local-draft
 */
import { afterEach, describe, expect, it } from 'vitest'

import { clearDraft, draftKey, readDraft, reconcileDraft, writeDraft, type ProposalLayout } from '@/features/proposals'

const empty: ProposalLayout = { version: 2, sections: [] }
const edited: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }

afterEach(() => {
  localStorage.clear()
})

describe('draftKey', () => {
  it('scopes the key by user id and template id, so one account never sees another\'s draft', () => {
    expect(draftKey('user-a', 't1')).not.toBe(draftKey('user-b', 't1'))
    expect(draftKey('user-a', 't1')).not.toBe(draftKey('user-a', 't2'))
  })

  it('scopes the key by kind, so a proposal and a template with the same id never read each other\'s draft', () => {
    expect(draftKey('user-a', 'x1', 'proposal')).not.toBe(draftKey('user-a', 'x1', 'template'))
  })

  it('leaves template keys exactly where they were, so a draft written before the kind argument existed is still found', () => {
    // Pinned to the literal string on purpose: these keys are already in
    // deployed browsers, and changing the shape would silently strand
    // every in-flight template draft rather than fail anything.
    expect(draftKey('user-a', 't1')).toBe('zebri:proposal-draft:user-a:t1')
    expect(draftKey('user-a', 't1', 'template')).toBe('zebri:proposal-draft:user-a:t1')
  })

  it('keeps a proposal draft and a template draft with the same id apart in storage', () => {
    writeDraft(draftKey('u', 'x1', 'template'), { layout: empty, baseRevision: 0, savedAt: 1 })
    writeDraft(draftKey('u', 'x1', 'proposal'), { layout: edited, baseRevision: 0, savedAt: 1 })
    expect(readDraft(draftKey('u', 'x1', 'template'))?.layout).toEqual(empty)
    expect(readDraft(draftKey('u', 'x1', 'proposal'))?.layout).toEqual(edited)
  })
})

describe('writeDraft / readDraft / clearDraft', () => {
  it('round-trips a draft through localStorage', () => {
    const key = draftKey('u', 't1')
    expect(writeDraft(key, { layout: edited, baseRevision: 3, savedAt: 1000 })).toBe(true)
    expect(readDraft(key)).toEqual({ layout: edited, baseRevision: 3, savedAt: 1000 })
    clearDraft(key)
    expect(readDraft(key)).toBeNull()
  })

  it('returns null for a missing, malformed, or invalid-layout draft', () => {
    const key = draftKey('u', 't1')
    expect(readDraft(key)).toBeNull()
    localStorage.setItem(key, 'not json')
    expect(readDraft(key)).toBeNull()
    localStorage.setItem(key, JSON.stringify({ layout: { version: 1 }, baseRevision: 0, savedAt: 1 }))
    expect(readDraft(key)).toBeNull()
  })
})

describe('reconcileDraft', () => {
  it('applies a draft made on top of the revision the server still holds, and marks it dirty', () => {
    const result = reconcileDraft({ layout: empty, revision: 2 }, { layout: edited, baseRevision: 2, savedAt: 1 })
    expect(result).toEqual({ layout: edited, dirty: true })
  })

  it('discards a draft when the server has moved on to a newer revision', () => {
    const result = reconcileDraft({ layout: empty, revision: 5 }, { layout: edited, baseRevision: 2, savedAt: 1 })
    expect(result).toEqual({ layout: empty, dirty: false })
  })

  it('treats a draft identical to the server row as already saved', () => {
    const result = reconcileDraft({ layout: edited, revision: 2 }, { layout: edited, baseRevision: 2, savedAt: 1 })
    expect(result).toEqual({ layout: edited, dirty: false })
  })

  it('uses the server row when there is no draft', () => {
    expect(reconcileDraft({ layout: empty, revision: 0 }, null)).toEqual({ layout: empty, dirty: false })
  })
})
