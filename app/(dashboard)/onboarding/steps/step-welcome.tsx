'use client'

import Image from 'next/image'

/**
 * Step 1: what Zebri is, in a breath.
 *
 * Split layout: the welcome message sits on the left (~40%), with a clean,
 * flush bento grid of wedding photos filling the right — the founder's own
 * wedding, rendered black and white so the wall reads as one calm piece
 * behind the copy rather than five competing images.
 *
 * The photos lead: they fade in one by one first, and the message follows
 * once the wall is up — so "these photos are from my own wedding" arrives
 * with the photos already there to point at. On phones the grid hides and
 * a single photo leads above the copy instead, on a faster clock.
 */
export function StepWelcome() {
  return (
    <div className="h-full flex flex-col sm:flex-row items-stretch gap-8 sm:gap-10">
      <div className="flex-1 sm:w-[40%] sm:flex-none flex flex-col justify-center gap-5 text-center sm:text-left px-4 sm:pl-6 sm:pr-0">
        {/* On phones the photo grid is hidden, so one photo leads above the
            copy — "These photos" has to be true on every screen. */}
        <div className="order-first sm:hidden relative h-40 overflow-hidden animate-tile-in">
          <Image src="/wedding/wed-3.jpeg" alt="" fill sizes="100vw" className="object-cover grayscale" />
        </div>

        <h2 className="text-3xl font-semibold text-text animate-tile-in [animation-delay:500ms] sm:[animation-delay:3200ms]">
          Welcome to Zebri
        </h2>
        <p className="text-sm text-text-muted leading-relaxed animate-tile-in [animation-delay:900ms] sm:[animation-delay:3700ms]">
          These photos are from my own wedding. The people who made that day
          so special are the reason Zebri exists.
        </p>
        <p className="text-sm text-text-muted leading-relaxed animate-tile-in [animation-delay:1300ms] sm:[animation-delay:4200ms]">
          We built Zebri so you can spend more time doing what you do best
          and creating unforgettable moments for your couples.
        </p>
      </div>

      {/* The photo column — hidden on phones where it would crowd the copy. */}
      <div className="hidden sm:grid flex-1 grid-cols-2 grid-rows-4 gap-3" aria-hidden>
        {TILES.map(({ src, cls }) => (
          <div key={src} className={`relative overflow-hidden bg-surface-muted animate-tile-in ${cls}`}>
            <Image src={src} alt="" fill sizes="30vw" className="object-cover grayscale" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Flush, full-cell tiles in two generous columns: portraits in the tall
// cells, landscapes in the wide ones, and the two columns break at
// different rows so no horizontal seam runs straight through. Each photo
// fades in slowly (1.3s, no movement), spaced 600ms apart, and the text
// follows once the wall is up.
const TILES = [
  { src: '/wedding/wed-1.jpeg', cls: 'col-start-1 row-start-1 row-span-2 [animation-delay:0ms]' },
  { src: '/wedding/wed-3.jpeg', cls: 'col-start-2 row-start-1 [animation-delay:600ms]' },
  { src: '/wedding/wed-2.jpeg', cls: 'col-start-2 row-start-2 row-span-2 [animation-delay:1200ms]' },
  { src: '/wedding/wed-4.jpeg', cls: 'col-start-1 row-start-3 row-span-2 [animation-delay:1800ms]' },
  { src: '/wedding/wed-5.jpeg', cls: 'col-start-2 row-start-4 [animation-delay:2400ms]' },
]
