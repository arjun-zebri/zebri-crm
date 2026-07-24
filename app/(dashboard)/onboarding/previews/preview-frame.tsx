'use client'

import {
  LayoutDashboard,
  Target,
  Calendar,
  CheckSquare,
  Contact,
  CreditCard,
  Sparkles,
  FileStack,
  MousePointer2,
} from 'lucide-react'
import Image from 'next/image'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Sidebar destinations a preview can navigate to. */
export type NavKey = 'couples' | 'templates' | 'automations'

/** Props implemented by every preview script. */
export interface PreviewScriptProps {
  /** True when this preview's step is on screen. */
  active: boolean
  reducedMotion: boolean
}

/** Props for {@link PreviewFrame}. */
export interface PreviewFrameProps {
  activeNav: NavKey
  /** True once the sidebar click beat has landed. */
  navClicked: boolean
  /** `data-cursor` value of the element the pointer should sit on, or null to hide it. */
  cursorTarget?: string | null
  /** True on beats where the pointer is clicking (fires the one-shot ripple). */
  clicking?: boolean
  /** Bumped every beat so the pointer re-measures as the layout changes. */
  cursorRevision?: number
  /**
   * Modal layer rendered over the WHOLE frame — sidebar included — so an
   * in-preview modal dims the entire miniature app, exactly as a real modal
   * dims the entire real app. The cursor stays above it.
   */
  overlay?: ReactNode
  children: ReactNode
}

// Same order and icons as the real sidebar (app/components/sidebar.tsx), so
// the miniature reads as the product the user is about to use rather than a
// lookalike. Dashboard/Calendar/Tasks/Contacts/Payments are inert scenery.
const NAV = [
  { key: 'dashboard' as const, label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'couples' as const, label: 'Couples', Icon: Target },
  { key: 'calendar' as const, label: 'Calendar', Icon: Calendar },
  { key: 'tasks' as const, label: 'Tasks', Icon: CheckSquare },
  { key: 'contacts' as const, label: 'Contacts', Icon: Contact },
  { key: 'payments' as const, label: 'Payments', Icon: CreditCard },
  { key: 'automations' as const, label: 'Automations', Icon: Sparkles },
  { key: 'templates' as const, label: 'Templates', Icon: FileStack },
]

/**
 * A miniature Zebri window: sidebar rail on the left, content on the right.
 *
 * All four previews share this chassis so the set reads as one product. It
 * fills its parent (`h-full`) so the preview stretches to the bottom of the
 * wizard. The fake pointer is positioned by measuring the real element named
 * by `cursorTarget` (its `data-cursor` attribute) and moving the cursor node
 * imperatively — so a click lands on the actual control and moving it never
 * costs a React render. The click ripple is a one-shot Web Animation fired
 * on arrival: it plays once and stops, so a resting cursor never pulses.
 */
export function PreviewFrame({
  activeNav,
  navClicked,
  cursorTarget,
  clicking,
  cursorRevision,
  overlay,
  children,
}: PreviewFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const cursor = cursorRef.current
    const ring = ringRef.current
    if (!frame || !cursor || !ring) return

    // A null target means "no pointer this beat" — hide it. A named target
    // that isn't in the DOM yet (its content is still fading in on the
    // trailing content clock) leaves the pointer where it is; the effect
    // re-runs when the content lands and the pointer glides onto it then.
    if (!cursorTarget) {
      cursor.style.opacity = '0'
      return
    }
    const el = frame.querySelector<HTMLElement>(`[data-cursor="${cursorTarget}"]`)
    if (!el) return
    const fr = frame.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    cursor.style.left = `${er.left + er.width / 2 - fr.left}px`
    cursor.style.top = `${er.top + er.height / 2 - fr.top}px`
    cursor.style.opacity = '1'

    // One-shot ripple, fired only on the beat's actual click (jsdom has no
    // WAAPI, hence the guard). Plays once and ends — never loops.
    if (clicking && typeof ring.animate === 'function') {
      ring.animate(
        [
          { transform: 'scale(0.3)', opacity: 0.9 },
          { transform: 'scale(1.7)', opacity: 0 },
        ],
        { duration: 450, easing: 'ease-out' },
      )
    }
  }, [cursorTarget, clicking, cursorRevision])

  return (
    <div
      ref={frameRef}
      className="relative rounded-xl border border-border bg-surface overflow-hidden flex h-full shadow-sm"
    >
      <nav className="w-12 sm:w-44 shrink-0 border-r border-border bg-surface py-3 px-2 flex flex-col gap-0.5">
        {/* Real brand mark, not a stand-in letter. */}
        <Image
          src="/zebri-icon.svg"
          alt="Zebri"
          width={24}
          height={24}
          className="w-6 h-6 mb-3 ml-1 shrink-0"
        />
        {NAV.map(({ key, label, Icon }) => {
          const on = navClicked && key === activeNav
          return (
            <span
              key={key}
              data-cursor={`nav-${key}`}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors duration-300 ${
                on ? 'bg-surface-muted text-text font-medium' : 'text-text-subtle'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} className="shrink-0" />
              <span data-active={on ? 'true' : 'false'} className="hidden sm:inline truncate">
                {label}
              </span>
            </span>
          )
        })}
      </nav>

      <div className="flex-1 min-w-0 p-3 sm:p-4 relative overflow-hidden">{children}</div>

      {/* Frame-wide modal layer — dims the sidebar too. */}
      {overlay}

      {/* The single fake pointer, moved imperatively by the effect above.
          Kept mounted so the browser tweens between measured positions. */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-30 opacity-0 transition-all duration-[450ms] ease-out"
      >
        <span ref={ringRef} className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full bg-brand-fg/25 opacity-0" />
        <MousePointer2
          size={18}
          strokeWidth={1.5}
          className="relative -left-0.5 -top-0.5 text-text fill-surface drop-shadow-sm"
        />
      </div>
    </div>
  )
}
