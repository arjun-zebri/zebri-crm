'use client'

/**
 * Page frame primitives (spec §7.2, D2). In `page` mode every top-level block
 * is a full-width `<section>` with an optional background and a reveal
 * animation; the content sits in a centred column at `max-w-doc-page`. The
 * hero is the exception: it owns the full width and its own height.
 *
 * @module lib/branding/page-section
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports -- type-only; the block AST lives with the editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

import type { FrameMode } from './public-blocks/shared'
import { pad } from './public-blocks/shared'
import type { PublicBranding } from './public-surface'

/**
 * Reveal-on-scroll state for a section. Starts hidden only when the
 * animation is enabled AND IntersectionObserver exists (R9); otherwise the
 * section is visible from the first paint (SSR, print, old browsers).
 */
export function useReveal(enabled: boolean): { ref: React.RefObject<HTMLElement | null>; revealed: boolean } {
  const ref = useRef<HTMLElement | null>(null)
  const [revealed, setRevealed] = useState(!enabled)
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: this branch only runs once per mount (no observer to defer to), and it terminates the effect immediately after, so it cannot cascade.
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return { ref, revealed }
}

/**
 * One full-width section of the page frame.
 *
 * @param block - Supplies `sectionBackground` and the hero exception.
 * @param frame - `page` animates; `print` and `document` never do.
 */
export function PageSection({
  block,
  branding,
  frame,
  children,
}: {
  block: Block
  branding: PublicBranding
  frame: FrameMode
  children: ReactNode
}) {
  const isHero = block.type === 'hero'
  const animate = frame === 'page' && !isHero
  const { ref, revealed } = useReveal(animate)
  const bg = block.sectionBackground
  const overlay = Math.min(100, Math.max(0, bg?.overlay ?? 0)) / 100
  return (
    <section
      ref={ref}
      data-block-id={block.id}
      data-block-type={block.type}
      // print:opacity-100 alongside motion-reduce: browser-native printing
      // takes a static snapshot of the DOM with no scroll, so a section that
      // never intersected the viewport would stay at reveal-hidden opacity-0
      // and print blank below the fold without it.
      className={`relative w-full ${animate ? (revealed ? 'animate-reveal-up' : 'opacity-0 motion-reduce:opacity-100 print:opacity-100') : ''}`}
      style={bg?.color ? { background: bg.color } : undefined}
    >
      {bg?.imageUrl ? (
        <div
          aria-hidden
          data-section-image
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${bg.imageUrl}")` }}
        />
      ) : null}
      {bg?.imageUrl && overlay > 0 ? (
        <div aria-hidden data-section-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      ) : null}
      {isHero ? (
        <div className="relative">{children}</div>
      ) : (
        <div className={`relative mx-auto w-full max-w-doc-page ${pad(branding).docX} ${pad(branding).page}`}>{children}</div>
      )}
    </section>
  )
}
