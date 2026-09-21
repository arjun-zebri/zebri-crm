/**
 * The IntersectionObserver half of the public proposal's engagement
 * tracker (spec 9, plan E1).
 *
 * Kept apart from `./engagement-tracker` (which owns the queue, the flush
 * schedule and the bus subscription) because this is the one piece with
 * no React in it: it takes a ledger and a selector and reports visibility.
 *
 * @module app/proposal/[token]/_components/engagement-observe
 */
import type { VisibleLedger } from './engagement-session'

/**
 * Watches a CSS selector's elements with one `IntersectionObserver`,
 * starting/stopping `ledger` (and mirroring membership into `visible`, so
 * a later `visibilitychange` resume knows exactly which ids to restart)
 * per element's `attr` value as it crosses `threshold`. Returns a
 * disconnect function; a no-op when `IntersectionObserver` does not exist
 * (old browsers), the same guard `useReveal` in `page-section.tsx` uses.
 */
export function observe(
  selector: string,
  attr: string,
  threshold: number,
  ledger: VisibleLedger,
  visible: Set<string>,
  onEnter?: (id: string, el: Element) => void,
): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  const io = new IntersectionObserver(
    (entries) => {
      const now = Date.now()
      for (const entry of entries) {
        const id = entry.target.getAttribute(attr)
        if (!id) continue
        // M3: `isIntersecting` is true at ANY overlap (per spec), not at
        // this observer's own threshold -- one pixel onscreen still banked
        // a full second at threshold 0.5. Compare the ratio instead.
        if (entry.intersectionRatio >= threshold) {
          visible.add(id)
          ledger.start(id, now)
          onEnter?.(id, entry.target)
        } else {
          visible.delete(id)
          ledger.stop(id, now)
        }
      }
    },
    { threshold },
  )
  document.querySelectorAll(selector).forEach((el) => io.observe(el))
  return () => io.disconnect()
}
