import { describe, expect, it } from 'vitest'

import { deviceSplit, packageReport, sectionReport } from '@/features/proposals/analytics/reports'
import type { EngagementRow } from '@/features/proposals/analytics/summary'
import { acceptanceRate } from '@/features/proposals/analytics/types'

const row = (session_id: string, type: string, payload: unknown, created_at = '2026-09-30T00:00:00Z'): EngagementRow => ({ session_id, type, payload, created_at })
const view = (session: string, sectionId: string, seconds = 10) => row(session, 'section_viewed', { sectionId, sectionKind: 'x', seconds })
const sections = [{ id: 'a', label: 'Cover' }, { id: 'b', label: 'Packages' }, { id: 'c', label: 'FAQ' }]

describe('sectionReport', () => {
  it('returns page order with reach falling down the page and summed seconds', () => {
    const rows = [view('S1', 'a'), view('S1', 'b'), view('S1', 'c'), view('S2', 'a'), view('S2', 'b'), view('S3', 'a')]
    expect(sectionReport(rows, sections)).toEqual([
      { id: 'a', label: 'Cover', seconds: 30, reachPct: 100 },
      { id: 'b', label: 'Packages', seconds: 20, reachPct: 67 },
      { id: 'c', label: 'FAQ', seconds: 10, reachPct: 33 },
    ])
  })

  it('counts a session that only viewed a later section as reaching earlier ones', () => {
    const r = sectionReport([view('S1', 'c')], sections)
    expect(r.map((x) => x.reachPct)).toEqual([100, 100, 100])
    expect(r.map((x) => x.seconds)).toEqual([0, 0, 10])
  })

  it('ignores unknown section ids and v1 rows without throwing', () => {
    const rows = [view('S1', 'zzz'), row('S1', 'section_viewed', { blockId: 'a', blockType: 'hero', seconds: 5 })]
    expect(sectionReport(rows, sections).every((s) => s.seconds === 0 && s.reachPct === 0)).toBe(true)
  })

  it('gives every section zeros when there are no rows', () => {
    expect(sectionReport([], sections)).toEqual([
      { id: 'a', label: 'Cover', seconds: 0, reachPct: 0 },
      { id: 'b', label: 'Packages', seconds: 0, reachPct: 0 },
      { id: 'c', label: 'FAQ', seconds: 0, reachPct: 0 },
    ])
  })

  it('counts malformed payloads as 0 seconds and never throws', () => {
    const rows = [
      row('S1', 'section_viewed', null),
      row('S1', 'section_viewed', 'nope'),
      row('S1', 'section_viewed', { sectionId: 'a', seconds: -5 }),
      row('S1', 'section_viewed', { sectionId: 'a', seconds: 'x' }),
    ]
    expect(sectionReport(rows, sections)[0]).toMatchObject({ seconds: 0 })
  })
})

const options = [{ id: 'o2', title: 'Full day', position: 1 }, { id: 'o1', title: 'Reception', position: 0 }, { id: 'o3', title: 'Premium', position: 2 }]
const pv = (session: string, optionId: string, seconds: number) => row(session, 'package_viewed', { optionId, seconds })

describe('packageReport', () => {
  it('counts distinct viewing sessions, sums seconds, orders by position and keeps unviewed options', () => {
    const rows = [pv('S1', 'o1', 5), pv('S1', 'o1', 7), pv('S2', 'o1', 3), pv('S1', 'o2', 20)]
    expect(packageReport(rows, options, 'o2')).toEqual([
      { optionId: 'o1', title: 'Reception', views: 2, seconds: 15, chosenBy: null },
      { optionId: 'o2', title: 'Full day', views: 1, seconds: 20, chosenBy: 'accepted' },
      { optionId: 'o3', title: 'Premium', views: 0, seconds: 0, chosenBy: null },
    ])
  })

  it('marks the latest package_selected as selected, not accepted, when nothing is accepted', () => {
    const rows = [
      row('S1', 'package_selected', { optionId: 'o1' }, '2026-09-30T00:00:01Z'),
      row('S2', 'package_selected', { optionId: 'o3' }, '2026-09-30T00:00:09Z'),
    ]
    const report = packageReport(rows, options, null)
    expect(report.map((p) => [p.optionId, p.chosenBy])).toEqual([['o1', null], ['o2', null], ['o3', 'selected']])
    expect(packageReport([], options, null).every((p) => p.chosenBy === null)).toBe(true)
  })

  it('the accepted option beats a later package_selected on another option', () => {
    const rows = [row('S1', 'package_selected', { optionId: 'o3' }, '2026-09-30T00:00:09Z')]
    const report = packageReport(rows, options, 'o1')
    expect(report.map((p) => [p.optionId, p.chosenBy])).toEqual([['o1', 'accepted'], ['o2', null], ['o3', null]])
  })
})

describe('deviceSplit', () => {
  it('counts sessions once by their opened device, unknown when missing', () => {
    const rows = [
      row('S1', 'opened', { device: 'phone' }),
      row('S1', 'opened', { device: 'phone' }),
      row('S2', 'opened', { device: 'desktop' }),
      row('S3', 'opened', {}),
      row('S4', 'section_viewed', { sectionId: 'a', seconds: 1 }),
      row('S5', 'opened', { device: 'tablet' }),
    ]
    expect(deviceSplit(rows)).toEqual({ phone: 1, tablet: 1, desktop: 1, unknown: 2 })
  })
})

describe('acceptanceRate', () => {
  it('is null with nothing sent, else a whole percentage', () => {
    expect(acceptanceRate({ sent: 0, accepted: 0 })).toBeNull()
    expect(acceptanceRate({ sent: 3, accepted: 1 })).toBe(33)
  })
})
