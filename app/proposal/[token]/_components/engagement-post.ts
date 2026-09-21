/**
 * Batch delivery for the public proposal's engagement tracker (spec 9).
 *
 * Kept apart from `./engagement-session` (session identity and the
 * visible-time ledger) so the two can be read and tested on their own:
 * this module is the only place that knows the events route exists.
 *
 * @module app/proposal/[token]/_components/engagement-post
 */
import type { EventsBody } from '@/lib/proposals/engagement-events'

/**
 * Posts one batch of events to `/api/proposal/events` (Task 3). Uses
 * `sendBeacon` when asked (unload-time flushes, which cannot wait on
 * `fetch`) and otherwise a `keepalive` fetch, falling back to `fetch` when
 * `sendBeacon` itself is unavailable (an old browser, or a test/embed
 * environment without it).
 *
 * Resolves `true` only on a believed delivery: `sendBeacon`'s own boolean
 * return, or a `fetch` response with a 2xx status. Never throws or
 * rejects -- a network error, a thrown `sendBeacon`, or a non-2xx status
 * all resolve `false`, so `flush` (`./engagement-tracker`) can `await`
 * this and requeue on `false` (C2) without a `try/catch` of its own.
 */
export async function postEvents(body: EventsBody, opts: { beacon: boolean }): Promise<boolean> {
  const json = JSON.stringify(body)
  try {
    if (opts.beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      return navigator.sendBeacon('/api/proposal/events', new Blob([json], { type: 'text/plain' }))
    }
    const res = await fetch('/api/proposal/events', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: json,
    })
    return res.ok
  } catch {
    // Best-effort telemetry: a dropped batch is never worth surfacing as
    // an error, but the caller still needs to know it did not land.
    return false
  }
}
