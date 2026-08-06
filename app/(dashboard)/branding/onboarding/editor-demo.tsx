'use client'

import { MousePointer2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

// The beat clock is generic; it lives with the welcome-tour previews
// because that feature built it first.
import { usePreviewScript, useSettledBeat } from '@/app/(dashboard)/onboarding/previews/use-preview-script'

import { DemoDoc, DEMO_GREEN, DEMO_GOLD } from './demo-doc'
import { DemoRail } from './editor-demo-rail'
import { DemoTabs } from './editor-demo-tabs'

/**
 * Three chapters, each opened by a white title card, then played by the
 * pointer in the miniature editor. The first card holds three beats (its
 * copy is short); the denser second and third hold four. Every card is
 * followed by one rest beat so the crossfade fully reveals the editor
 * before the pointer starts moving — without it, the first click of each
 * chapter lands while the card is still fading.
 *
 * - Documents (4-6): gear → popover → Run sheet ticked, its tab appears.
 * - Brand kit (12-19): Brand colours opened, a green picked for headings;
 *   Typography opened, Playfair picked, heading size bumped — every change
 *   sweeps the whole document, because the kit is global.
 * - Blocks (25-27): the Accept button clicked, its toolbar opens, a bronze
 *   picked — only that block changes.
 *
 * No loop: the animation rests on the final frame (a looping animation
 * competes with the Finish button).
 * @internal
 */
const BEATS = 28

/** Title-card copy, keyed by chapter. @internal */
const TITLES = [
  { heading: 'Add or remove documents', sub: 'Choose which documents you send, from the strip at the top.' },
  { heading: 'Style everything with your brand kit', sub: 'Colours, fonts and sizes in the brand kit apply to every document at once.' },
  { heading: 'Fine-tune individual blocks', sub: 'Click any block on the page to style just that one.' },
]

/** Which title card covers the frame on a given raw beat. @internal */
const TITLE_AT: Record<number, number> = {
  0: 0, 1: 0, 2: 0,
  7: 1, 8: 1, 9: 1, 10: 1,
  20: 2, 21: 2, 22: 2, 23: 2,
}

// The pointer's itinerary, one entry per beat (same shape as the welcome
// scripts): where it glides to, and whether it clicks on arrival. The null
// beat after each title block is the post-crossfade rest.
const CURSOR: ({ target: string; click?: boolean } | null)[] = [
  null,
  null,
  null,
  null,
  { target: 'doc-gear', click: true },
  { target: 'doc-run-sheet', click: true },
  null,
  null,
  null,
  null,
  null,
  null,
  { target: 'rail-colors', click: true },
  { target: 'swatch-heading', click: true },
  { target: 'pick-green', click: true },
  { target: 'rail-fonts', click: true },
  { target: 'font-picker', click: true },
  { target: 'font-playfair', click: true },
  { target: 'size-slider', click: true },
  null,
  null,
  null,
  null,
  null,
  null,
  { target: 'doc-accept', click: true },
  { target: 'toolbar-gold', click: true },
  null,
]

/**
 * Props for the editor demo scene.
 * @internal
 */
export interface EditorDemoProps {
  reducedMotion: boolean
}

/**
 * EditorDemo — a miniature branding editor the fake pointer clicks through.
 *
 * The chassis replicates the real editor (topbar, tab strip + gear, brand
 * rail, canvas) and the canvas renders the real public document. The pointer
 * is positioned by measuring the element named by the current beat's
 * `data-cursor` target — the same mechanism as the welcome tour's
 * PreviewFrame (which is app-chrome specific, hence the local copy).
 *
 * A hairline progress bar along the top fills linearly across the whole
 * sequence, so it is clear how long the tour runs. Title cards crossfade
 * with the editor rather than popping, and their text rises in with a small
 * stagger.
 * @internal
 */
export function EditorDemo({ reducedMotion }: EditorDemoProps) {
  const beat = usePreviewScript({ beats: BEATS, active: true, reducedMotion, beatMs: 1400 })
  const view = useSettledBeat(beat)
  const c = CURSOR[beat]
  const clicking = !!c?.click && view === beat

  // The overlay stays mounted and fades, so leaving a title card reveals the
  // editor as a crossfade rather than a cut. State keeps the last card's copy
  // on screen while its opacity animates out (render-time set with a guard —
  // the same pattern usePreviewScript uses for its replay reset).
  const titleIndex = TITLE_AT[beat]
  const title = titleIndex !== undefined ? TITLES[titleIndex] : undefined
  const [shownTitle, setShownTitle] = useState({ index: 0, copy: TITLES[0]! })
  if (title !== undefined && titleIndex !== undefined && shownTitle.index !== titleIndex) {
    setShownTitle({ index: titleIndex, copy: title })
  }

  // Content state trails the pointer (view), so every click lands before its
  // effect shows. Closes are keyed to the RAW beat instead: anything that
  // shifts layout (the colours section collapsing) or covers the next target
  // (the font menu over the size slider) must be gone at the start of the
  // beat, before the pointer measures its next destination — otherwise it
  // glides to a stale position and visibly corrects itself.
  const docsOpen = view >= 4 && view < 6
  const runSheetOn = view >= 5
  const colorsOpen = view >= 12 && beat < 15
  // Pick-one popovers (palette, font menu, block toolbar) close on the same
  // settle tick as their pick, like real single-choice popovers do — the
  // click and the close read as one gesture.
  const paletteOpen = view >= 13 && view < 14
  const headingHex = view >= 14 ? DEMO_GREEN : '#111827'
  const fontsOpen = view >= 15
  const fontMenuOpen = view >= 16 && view < 17
  const fontHeading = view >= 17 ? ('playfair' as const) : ('inter' as const)
  const headingSize = view >= 18 ? 40 : 32
  // The ring stays a moment longer than the toolbar, then clears on the
  // final rest beat so nothing lingers over the result.
  const selected = view >= 25 && beat < 27
  const toolbarOpen = view >= 25 && view < 26
  const buttonColor = view >= 26 ? DEMO_GOLD : undefined

  const frameRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const cursor = cursorRef.current
    const ring = ringRef.current
    if (!frame || !cursor || !ring) return
    if (!c?.target) {
      cursor.style.opacity = '0'
      return
    }
    // The target can be gone by click time when the click itself closes its
    // popover (single-choice picks unmount on the same settle tick). The
    // cursor is already resting on the right spot from the glide, so only
    // reposition when the element is still there — but always play the
    // ripple, or those clicks would show no feedback.
    const el = frame.querySelector<HTMLElement>(`[data-cursor="${c.target}"]`)
    if (el) {
      const fr = frame.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      cursor.style.left = `${er.left + er.width / 2 - fr.left}px`
      cursor.style.top = `${er.top + er.height / 2 - fr.top}px`
      cursor.style.opacity = '1'
    }
    // One-shot click ripple (jsdom has no WAAPI, hence the guard).
    if (clicking && typeof ring.animate === 'function') {
      ring.animate(
        [
          { transform: 'scale(0.3)', opacity: 0.9 },
          { transform: 'scale(1.7)', opacity: 0 },
        ],
        { duration: 450, easing: 'ease-out' },
      )
    }
  }, [c?.target, clicking, beat, view])

  return (
    <div
      ref={frameRef}
      className="relative rounded-control border border-border bg-surface overflow-hidden flex flex-col h-full shadow-sm"
    >
      <DemoTabs docsOpen={docsOpen} runSheetOn={runSheetOn} />

      <div className="flex flex-1 min-h-0">
        <DemoRail
          colorsOpen={colorsOpen}
          paletteOpen={paletteOpen}
          headingHex={headingHex}
          fontsOpen={fontsOpen}
          fontMenuOpen={fontMenuOpen}
          fontHeading={fontHeading}
          headingSize={headingSize}
        />
        {/* Canvas: muted backdrop with the real document floating on it. */}
        <div className="relative flex-1 min-w-0 bg-gray-50 overflow-hidden">
          <div className="absolute left-1/2 -translate-x-1/2 top-4">
            <DemoDoc
              headingHex={headingHex}
              fontHeading={fontHeading}
              headingSize={headingSize}
              {...(buttonColor ? { buttonColor } : {})}
              selected={selected}
              toolbarOpen={toolbarOpen}
            />
          </div>
        </div>
      </div>

      {/* Chapter title card: white, centered, crossfading with the editor.
          Keyed by chapter so the text's rise-in replays on each new card. */}
      <div
        data-testid="demo-title-card"
        aria-hidden={!title}
        className={`absolute inset-0 z-20 bg-surface flex flex-col items-center justify-center gap-2 px-8 text-center pointer-events-none transition-opacity duration-700 motion-reduce:transition-none ${
          title ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div key={shownTitle.index} className="flex flex-col items-center gap-2">
          <p className="text-lg font-semibold text-text demo-title-in">{shownTitle.copy.heading}</p>
          <p className="text-sm text-text-muted max-w-[380px] demo-title-in [animation-delay:180ms]">
            {shownTitle.copy.sub}
          </p>
        </div>
      </div>

      {/* Tour progress: fills linearly, one beat per step, across the run.
          Flush with the bottom edge, corner to corner — the frame's own
          rounded-control + overflow-hidden clip it to the container's corners. */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-surface-emphasis z-40" aria-hidden>
        <div
          className="h-full bg-brand-fg transition-[width] duration-[1400ms] ease-linear motion-reduce:transition-none"
          style={{ width: `${(beat / (BEATS - 1)) * 100}%` }}
        />
      </div>

      {/* The single fake pointer, moved imperatively by the effect above. */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-30 opacity-0 transition-all duration-[450ms] ease-out"
      >
        <span ref={ringRef} className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-pill bg-brand-fg/25 opacity-0" />
        <MousePointer2
          size={18}
          strokeWidth={1.5}
          className="relative -left-0.5 -top-0.5 text-text fill-surface drop-shadow-sm"
        />
      </div>

      <style>{`
        @keyframes demo-title-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .demo-title-in { animation: demo-title-in 600ms ease-out backwards; }
        @media (prefers-reduced-motion: reduce) {
          .demo-title-in { animation: none; }
        }
      `}</style>
    </div>
  )
}
