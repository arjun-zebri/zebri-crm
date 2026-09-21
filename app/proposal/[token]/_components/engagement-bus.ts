/**
 * In-page pub/sub for proposal engagement events (spec 9, plan E5).
 *
 * The tracker (`./engagement-tracker`) owns the batching, ledgering and
 * flush schedule, but the events it needs to relay -- `package_selected`,
 * `addon_toggled`, `step_reached`, `accepted`, `declined` -- are raised
 * from three unrelated components (`proposal-page.tsx`, `use-accept-flow`,
 * `decline-form`) that have no reason to import the tracker or hold a ref
 * to it. A tiny module-level bus decouples "something happened" from
 * "batch it and post it": any component can emit, and the one tracker
 * mounted on a public proposal page (one page per tab) is the only
 * subscriber.
 *
 * @module app/proposal/[token]/_components/engagement-bus
 */
import type { EngagementEvent } from '@/lib/proposals/engagement-events'

type Listener = (event: EngagementEvent) => void

/** Module-level subscriber set: intentionally not React state, since emitting must work from plain event handlers with no render involved. */
const listeners = new Set<Listener>()

/** Raise an engagement event to whatever tracker is currently subscribed. A no-op when nothing is listening (the tracker is disabled, or unmounted). */
export function emitEngagement(event: EngagementEvent): void {
  for (const fn of listeners) fn(event)
}

/** Subscribe to every emitted event; returns the unsubscribe function. */
export function subscribeEngagement(fn: (event: EngagementEvent) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
