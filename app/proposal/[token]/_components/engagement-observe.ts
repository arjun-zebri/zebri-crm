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
 * per element's `attr` value as it comes into view (see {@link isInView}). Returns a
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
        if (isInView(entry, threshold)) {
          // Several thresholds fire several callbacks while an element is
          // already in view; only the first entry is a real "enter".
          const entering = !visible.has(id)
          visible.add(id)
          ledger.start(id, now)
          if (entering) onEnter?.(id, entry.target)
        } else {
          visible.delete(id)
          ledger.stop(id, now)
        }
      }
    },
    { threshold: thresholdsFor(threshold) },
  )
  document.querySelectorAll(selector).forEach((el) => io.observe(el))
  return () => io.disconnect()
}

/**
 * Whether an observer entry counts as "in view" at `threshold`: either
 * that share of the ELEMENT is visible, or the visible part fills that
 * share of the VIEWPORT.
 *
 * M3: `isIntersecting` is true at ANY overlap, so one pixel onscreen would
 * bank time; the ratio check stops that. F1: `intersectionRatio` is the
 * share of the element, so a section taller than twice the viewport can
 * never reach 0.5 however long it is read. The viewport share covers it.
 * `rootBounds` is null in some cross-origin frames, so fall back to the
 * window height; a missing `intersectionRect` counts as nothing visible.
 */
export function isInView(entry: IntersectionObserverEntry, threshold: number): boolean {
  if (entry.intersectionRatio >= threshold) return true
  const visibleHeight = entry.intersectionRect?.height ?? 0
  const rootHeight = entry.rootBounds?.height || (typeof window === 'undefined' ? 0 : window.innerHeight)
  return rootHeight > 0 && visibleHeight / rootHeight >= threshold
}

/**
 * The observer's threshold list: 5% steps plus the caller's own
 * threshold. One threshold only fires when the ELEMENT ratio crosses it,
 * which a tall section never does, so it would get no callback while it
 * scrolled through. Quarter steps are not enough either: a section over
 * four viewports tall never passes 0.25, so its only callback would be
 * the sliver at its top edge. 5% steps cover sections up to twenty
 * viewports tall, far past any real proposal section.
 */
function thresholdsFor(threshold: number): number[] {
  const steps = Array.from({ length: 21 }, (_, i) => i / 20)
  return [...new Set([...steps, threshold])].sort((a, b) => a - b)
}
