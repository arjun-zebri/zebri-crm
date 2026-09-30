'use client'

/**
 * Engagement tracker for the public proposal page (spec 9, plan E1, E2,
 * E5). Renders nothing. Watches sections and package cards, banks visible
 * seconds, listens to the in-page bus for choice/step events, and flushes
 * batches to /api/proposal/events every 10 s and on pagehide.
 *
 * @module app/proposal/[token]/_components/engagement-tracker
 */
import { useEffect } from 'react'

import type { QueuedEngagementEvent } from '@/lib/proposals/engagement-events'

import { subscribeEngagement } from './engagement-bus'
import { observe } from './engagement-observe'
import { postEvents } from './engagement-post'
import { deviceKind, newEventId, sessionIdFor, visibleSecondsLedger } from './engagement-session'

const FLUSH_MS = 10_000
const BATCH = 50
// C2: caps the requeue below so a permanently-offline visitor cannot grow
// the in-memory queue without limit; the oldest pending events are
// dropped past this.
const MAX_QUEUED = 50

export interface EngagementTrackerProps {
  /** The proposal share token the batches are recorded against. Only read when `enabled`. */
  token: string
  /**
   * Only the live public page tracks. `proposal-page.tsx` passes
   * `frame === 'page' && Boolean(token)`, so print and the branding
   * preview (no `token`) genuinely pass `false` here (m6).
   */
  enabled: boolean
}

/** See {@link EngagementTrackerProps}. */
export function EngagementTracker({ token, enabled }: EngagementTrackerProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const sessionId = sessionIdFor(token)
    const sections = visibleSecondsLedger()
    const cards = visibleSecondsLedger()
    const v2Sections = visibleSecondsLedger()
    const blockTypes = new Map<string, string>()
    // v2 (Layout v2) sections carry a kind and, in the step flow, the page
    // they sit on; both are read once at first sight of the element.
    const v2Meta = new Map<string, { kind: string; pageId?: string }>()
    // Every entry carries its id from the moment it enters this queue --
    // stamped once here (or in the bus subscription / drain mapping
    // below), never regenerated on a requeued retry (`flush`'s `queue.
    // unshift(...chunk)`), which is what lets the server tell a retry
    // apart from a genuinely new event.
    const queue: QueuedEngagementEvent[] = [{ id: newEventId(), type: 'opened', payload: { device: deviceKind(window.innerWidth) } }]
    // ids currently intersecting each ledger, kept separately so a tab
    // that comes back from hidden restarts only what it actually stopped,
    // without mixing block ids and option ids in one set.
    const visibleSections = new Set<string>()
    const visibleCards = new Set<string>()
    const visibleV2 = new Set<string>()

    const flush = (beacon: boolean) => {
      const now = Date.now()
      const events: QueuedEngagementEvent[] = [
        ...queue.splice(0),
        ...sections.drain(now).map((s) => ({
          id: newEventId(),
          type: 'section_viewed' as const,
          payload: { blockId: s.id, blockType: blockTypes.get(s.id) ?? 'unknown', seconds: s.seconds },
        })),
        ...v2Sections.drain(now).map((s) => {
          const meta = v2Meta.get(s.id)
          return {
            id: newEventId(),
            type: 'section_viewed' as const,
            // Conditional spread: `pageId: undefined` is invalid under
            // exactOptionalPropertyTypes and would be dropped by JSON anyway.
            payload: { sectionId: s.id, sectionKind: meta?.kind ?? 'unknown', ...(meta?.pageId ? { pageId: meta.pageId } : {}), seconds: s.seconds },
          }
        }),
        ...cards.drain(now).map((c) => ({
          id: newEventId(),
          type: 'package_viewed' as const,
          payload: { optionId: c.id, seconds: c.seconds },
        })),
      ]
      if (events.length === 0) return
      for (let i = 0; i < events.length; i += BATCH) {
        const chunk = events.slice(i, i + BATCH)
        void postEvents({ token, sessionId, events: chunk }, { beacon }).then((ok) => {
          if (ok) return
          // C2: a batch that did not land goes back at the FRONT of the
          // queue instead of vanishing -- `opened` is queued exactly once,
          // at mount, so losing its one delivery attempt silently hid the
          // whole visit from the dashboard forever.
          queue.unshift(...chunk)
          if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED)
        })
      }
    }

    const disconnectSections = observe('[data-block-id]', 'data-block-id', 0.5, sections, visibleSections, (id, el) => {
      blockTypes.set(id, el.getAttribute('data-block-type') ?? 'unknown')
    })
    // A v1 page has no [data-section-id] and a v2 page has no [data-block-id],
    // so the two observers never double-count one section.
    const disconnectV2 = observe('[data-section-id]', 'data-section-id', 0.5, v2Sections, visibleV2, (id, el) => {
      const pageId = el.closest('[data-page-id]')?.getAttribute('data-page-id') ?? undefined
      v2Meta.set(id, { kind: el.getAttribute('data-section-kind') ?? 'unknown', ...(pageId ? { pageId } : {}) })
    })
    const disconnectCards = observe('[data-option-id]', 'data-option-id', 0.6, cards, visibleCards)

    const onVisibility = () => {
      const now = Date.now()
      if (document.visibilityState === 'hidden') {
        sections.stopAll(now)
        v2Sections.stopAll(now)
        cards.stopAll(now)
      } else {
        for (const id of visibleSections) sections.start(id, now)
        for (const id of visibleV2) v2Sections.start(id, now)
        for (const id of visibleCards) cards.start(id, now)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onPageHide = () => flush(true)
    window.addEventListener('pagehide', onPageHide)

    const timer = setInterval(() => flush(false), FLUSH_MS)
    // Stamped here, at the moment a bus event is queued: emit call sites
    // (`proposal-page.tsx`, `use-accept-flow.ts`, `decline-form.tsx`)
    // stay unaware of ids entirely.
    const unsub = subscribeEngagement((event) => queue.push({ ...event, id: newEventId() }))

    return () => {
      disconnectSections()
      disconnectV2()
      disconnectCards()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      clearInterval(timer)
      unsub()
      flush(true)
    }
  }, [token, enabled])
  return null
}
