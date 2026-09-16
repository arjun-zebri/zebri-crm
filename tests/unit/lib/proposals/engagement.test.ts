import { describe, expect, it } from 'vitest'

import { type EngagementRow, sessionTimelines, summarizeEngagement } from '@/lib/proposals/engagement'
import { blockTypeLabel, formatSeconds, stepLabel } from '@/lib/proposals/engagement-labels'

const at = (m: number) => new Date(Date.UTC(2026, 8, 15, 10, m)).toISOString()
const rows: EngagementRow[] = [
  { session_id: 'a', type: 'opened', payload: {}, created_at: at(0) },
  { session_id: 'a', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 10 }, created_at: at(1) },
  { session_id: 'a', type: 'section_viewed', payload: { blockId: 'p', blockType: 'packages', seconds: 40 }, created_at: at(1) },
  { session_id: 'a', type: 'package_viewed', payload: { optionId: 'o2', seconds: 25 }, created_at: at(1) },
  { session_id: 'a', type: 'package_viewed', payload: { optionId: 'o1', seconds: 5 }, created_at: at(1) },
  { session_id: 'a', type: 'package_selected', payload: { optionId: 'o2' }, created_at: at(2) },
  { session_id: 'a', type: 'step_reached', payload: { step: 'choose' }, created_at: at(2) },
  { session_id: 'a', type: 'step_reached', payload: { step: 'sign' }, created_at: at(3) },
  { session_id: 'b', type: 'opened', payload: {}, created_at: at(30) },
  { session_id: 'b', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 5 }, created_at: at(31) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'choose' }, created_at: at(32) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'sign' }, created_at: at(33) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'pay' }, created_at: at(34) },
  { session_id: 'b', type: 'accepted', payload: {}, created_at: at(34) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'done' }, created_at: at(35) },
  { session_id: 'c', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 1 }, created_at: at(40) },
]

describe('summarizeEngagement', () => {
  it('counts EVERY distinct session (C2/E4), sums time, ranks sections and packages, finds the furthest step and the outcome', () => {
    // Session 'c' has no 'opened' row (a lost first flush, C2) but still
    // has a real section_viewed row, so it counts as a session -- the
    // ruling this fix wave applies: sessions is every distinct
    // session_id, not only ones with a surviving 'opened'.
    const s = summarizeEngagement(rows)
    expect(s.sessions).toBe(3)
    expect(s.firstOpenedAt).toBe(at(0))
    expect(s.lastSeenAt).toBe(at(40))
    expect(s.totalSeconds).toBe(56)
    expect(s.sections).toEqual([
      { blockId: 'p', blockType: 'packages', seconds: 40 },
      { blockId: 'h', blockType: 'hero', seconds: 16 },
    ])
    expect(s.packages).toEqual([
      { optionId: 'o2', seconds: 25, selected: 1 },
      { optionId: 'o1', seconds: 5, selected: 0 },
    ])
    expect(s.lingeredOptionId).toBe('o2')
    expect(s.furthestStep).toBe('done')
    expect(s.outcome).toBe('accepted')
  })
  it('is empty-safe', () => {
    expect(summarizeEngagement([])).toEqual({
      sessions: 0, firstOpenedAt: null, lastSeenAt: null, totalSeconds: 0, sections: [], packages: [], lingeredOptionId: null, furthestStep: null, outcome: null,
    })
  })
  it('ignores malformed payloads instead of throwing', () => {
    const s = summarizeEngagement([{ session_id: 'x', type: 'section_viewed', payload: null, created_at: at(0) }, { session_id: 'x', type: 'section_viewed', payload: { seconds: 'ten' }, created_at: at(0) }])
    expect(s.totalSeconds).toBe(0)
  })
  it('m1: does not report a lingered package with zero banked seconds', () => {
    // A 'package_selected' with no matching 'package_viewed' (a pick made
    // without the tracker ever seeing the card visible) must not read
    // "Lingered on X (0s)".
    const s = summarizeEngagement([
      { session_id: 'x', type: 'opened', payload: {}, created_at: at(0) },
      { session_id: 'x', type: 'package_selected', payload: { optionId: 'o1' }, created_at: at(1) },
    ])
    expect(s.packages).toEqual([{ optionId: 'o1', seconds: 0, selected: 1 }])
    expect(s.lingeredOptionId).toBeNull()
  })
})

describe('sessionTimelines', () => {
  it('builds one timeline per session, newest first, with steps in order and the outcome', () => {
    const t = sessionTimelines(rows)
    expect(t.map((x) => x.sessionId)).toEqual(['c', 'b', 'a'])
    expect(t[1]).toMatchObject({ sessionId: 'b', startedAt: at(30), endedAt: at(35), seconds: 5, steps: ['choose', 'sign', 'pay', 'done'], outcome: 'accepted', selectedOptionId: null })
    expect(t[2]).toMatchObject({ sessionId: 'a', seconds: 50, steps: ['choose', 'sign'], selectedOptionId: 'o2', outcome: null })
    expect(t[2]?.sections[0]).toEqual({ blockId: 'p', blockType: 'packages', seconds: 40 })
  })
  it('honours the limit', () => {
    expect(sessionTimelines(rows, 1)).toHaveLength(1)
  })
})

describe('labels', () => {
  it('maps block types and steps to MC-facing copy', () => {
    expect(blockTypeLabel('introNote')).toBe('Personal note')
    expect(blockTypeLabel('howItWorks')).toBe('How it works')
    expect(blockTypeLabel('faq')).toBe('FAQ')
    expect(blockTypeLabel('richText')).toBe('RichText')
    expect(stepLabel('sign')).toBe('Signed')
  })
  it('formats seconds', () => {
    expect(formatSeconds(0)).toBe('0s')
    expect(formatSeconds(59)).toBe('59s')
    expect(formatSeconds(61)).toBe('1m 1s')
    expect(formatSeconds(3600)).toBe('1h 0m')
  })
})
