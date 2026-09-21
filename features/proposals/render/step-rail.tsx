'use client'

/**
 * The dot rail for step flow (`theme.flow === 'step'`, `model/theme.ts`):
 * one dot per page (`model/pages.ts`) pinned to the right edge of the
 * screen, the one currently on screen filled, click to jump. Reuses the
 * `data-page-id` anchors `layout.tsx` renders, so it needs no state of
 * its own beyond which page the `IntersectionObserver` last saw. Page
 * mode only; the editor canvas and print never mount it.
 *
 * @module features/proposals/render/step-rail
 */
import { useEffect, useState } from 'react'

/** One dot's worth of a page. */
export interface StepRailPage {
  /** The page's `data-page-id`. */
  id: string
  /** The dot's accessible name: the page's first section label. */
  label: string
}

/** Props for {@link StepRail}. */
export interface StepRailProps {
  pages: readonly StepRailPage[]
}

/** The step-flow dot rail. See the module doc. */
export function StepRail({ pages }: StepRailProps) {
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id ?? null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = pages
      .map((p) => document.querySelector<HTMLElement>(`[data-page-id="${p.id}"]`))
      .filter((el): el is HTMLElement => el !== null)
    // Half the screen: the page covering the middle of the viewport is
    // the one the dot rail should call current, whichever way it was reached.
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActiveId(hit.target.getAttribute('data-page-id'))
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pages])

  if (pages.length < 2) return null

  return (
    <nav aria-label="Pages" className="fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 max-md:right-1.5">
      {pages.map((p) => {
        const active = p.id === activeId
        return (
          <button
            key={p.id}
            type="button"
            aria-label={p.label}
            aria-current={active ? 'true' : undefined}
            onClick={() => document.querySelector(`[data-page-id="${p.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`h-2.5 w-2.5 rounded-pill border border-current transition ${active ? 'bg-current' : 'opacity-40 hover:opacity-80'}`}
          />
        )
      })}
    </nav>
  )
}
