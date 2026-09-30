/**
 * Pure per-proposal reports over `proposal_events` rows: reading depth by
 * section, package comparison and device mix. Rows come from an anonymous
 * browser, so every payload is read defensively (see `./read`).
 *
 * @module features/proposals/analytics/reports
 */
import { DEVICE_KINDS } from '@/lib/proposals/engagement-events'

import { num, obj, str } from './read'
import type { EngagementRow } from './summary'
import type { DeviceSplit, PackageChoice, PackageEngagementRow, SectionEngagementRow } from './types'

/**
 * Reading depth by section for one v2 proposal, in page order. `reachPct`
 * is the share of sessions that saw this section or any later one: a
 * reader who jumped straight to the packages still scrolled past the
 * cover, and counting them there keeps reach falling down the page, so
 * the biggest step down is where readers really leave.
 */
export function sectionReport(rows: EngagementRow[], sections: ReadonlyArray<{ id: string; label: string }>): SectionEngagementRow[] {
  const index = new Map(sections.map((s, i) => [s.id, i]))
  const seconds = new Array<number>(sections.length).fill(0)
  const deepest = new Map<string, number>()
  const sessions = new Set<string>()
  for (const r of rows) {
    sessions.add(r.session_id)
    if (r.type !== 'section_viewed') continue
    const p = obj(r.payload)
    const at = index.get(str(p.sectionId) ?? '')
    if (at === undefined) continue
    seconds[at] = (seconds[at] ?? 0) + num(p.seconds)
    deepest.set(r.session_id, Math.max(deepest.get(r.session_id) ?? -1, at))
  }
  const total = sessions.size
  return sections.map((s, i) => {
    let reached = 0
    for (const d of deepest.values()) if (d >= i) reached += 1
    return { id: s.id, label: s.label, seconds: seconds[i] ?? 0, reachPct: total === 0 ? 0 : Math.round((reached / total) * 100) }
  })
}

/**
 * Attention per package, in `position` order, including options nobody
 * viewed. `chosenBy` is `'accepted'` on the accepted option when known;
 * before acceptance (or when the accepted id is not recorded) the option
 * of the most recent `package_selected` row is `'selected'`, so an open
 * proposal still shows a lean without claiming a commitment.
 */
export function packageReport(
  rows: EngagementRow[],
  options: ReadonlyArray<{ id: string; title: string; position: number }>,
  acceptedOptionId: string | null,
): PackageEngagementRow[] {
  const viewers = new Map<string, Set<string>>()
  const seconds = new Map<string, number>()
  let latest: { at: string; optionId: string } | null = null
  for (const r of rows) {
    const p = obj(r.payload)
    const optionId = str(p.optionId)
    if (!optionId) continue
    if (r.type === 'package_viewed') {
      const set = viewers.get(optionId) ?? new Set<string>()
      set.add(r.session_id)
      viewers.set(optionId, set)
      seconds.set(optionId, (seconds.get(optionId) ?? 0) + num(p.seconds))
    } else if (r.type === 'package_selected' && (!latest || r.created_at >= latest.at)) {
      latest = { at: r.created_at, optionId }
    }
  }
  // Acceptance wins outright: a later card click on another package does
  // not undo a signature.
  const choiceFor = (id: string): PackageChoice => {
    if (acceptedOptionId) return id === acceptedOptionId ? 'accepted' : null
    return id === latest?.optionId ? 'selected' : null
  }
  return [...options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ optionId: o.id, title: o.title, views: viewers.get(o.id)?.size ?? 0, seconds: seconds.get(o.id) ?? 0, chosenBy: choiceFor(o.id) }))
}

/**
 * Sessions by opening device. Counts sessions, not events: a reload
 * writes a second `opened` row and must not double count. A session with
 * no recognisable device (v1 rows, a lost `opened`) is `unknown`.
 */
export function deviceSplit(rows: EngagementRow[]): DeviceSplit {
  const deviceOf = new Map<string, keyof DeviceSplit>()
  for (const r of rows) {
    if (!deviceOf.has(r.session_id)) deviceOf.set(r.session_id, 'unknown')
    if (r.type !== 'opened') continue
    const device = obj(r.payload).device
    const known = (DEVICE_KINDS as readonly unknown[]).includes(device)
    if (known && deviceOf.get(r.session_id) === 'unknown') deviceOf.set(r.session_id, device as keyof DeviceSplit)
  }
  const split: DeviceSplit = { phone: 0, tablet: 0, desktop: 0, unknown: 0 }
  for (const d of deviceOf.values()) split[d] += 1
  return split
}
