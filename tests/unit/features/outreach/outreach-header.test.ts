/**
 * The Outreach header's text helpers, and the rule that decides whether
 * Today collapses to one "All caught up" state.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/outreach/actions', () => ({}))

import { capText, headerExtras, pollSummary } from '@/features/outreach/outreach-header'
import { isQuietDay } from '@/features/outreach/views/today-view'
import type { TodayData } from '@/lib/outreach/services/queries'

const empty: TodayData = {
  igQueue: [],
  igCap: 20,
  igSentToday: 0,
  emailCap: 5,
  emailSentToday: 0,
  emailQueue: [],
  attention: [],
  awaitingIgReply: [],
  failed: [],
  upcomingDemos: [],
  sendingPaused: false,
  pausedReason: null,
  mailboxConnected: true,
}

describe('capText', () => {
  it('shows sent against the cap', () => {
    expect(capText(3, 20)).toBe('3/20')
  })

  it('says off when the cap is 0', () => {
    expect(capText(0, 0)).toBe('0 (off)')
  })
})

describe('pollSummary', () => {
  it('reports a recent poll as neutral news', () => {
    expect(pollSummary({ polled: false } as never)).toEqual({
      message: 'Mailbox was checked a moment ago. Try again shortly.',
      tone: 'info',
    })
  })

  it('counts replies and bounces with singulars', () => {
    expect(pollSummary({ polled: true, replies: 1, bounces: 2 } as never)).toBe('1 reply, 2 bounces')
  })
})

describe('isQuietDay', () => {
  it('is quiet when every list is empty', () => {
    expect(isQuietDay(empty)).toBe(true)
  })

  it('is not quiet when anything is waiting', () => {
    expect(isQuietDay({ ...empty, upcomingDemos: [{ prospectId: 'p', name: 'Jo', startsAt: '2026-10-13T00:00:00Z' }] })).toBe(false)
  })
})

describe('headerExtras', () => {
  it('shows nothing extra when no mailbox is connected', () => {
    expect(headerExtras('today', false)).toEqual({ counts: false, checkReplies: false })
  })

  it('shows counts and the check button on Today when a mailbox is connected', () => {
    expect(headerExtras('today', true)).toEqual({ counts: true, checkReplies: true })
  })

  it('keeps counts but hides the check button away from Today', () => {
    expect(headerExtras('prospects', true)).toEqual({ counts: true, checkReplies: false })
  })
})
