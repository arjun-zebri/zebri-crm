'use client'

/**
 * Hover tooltip for a link inside a section editor: shows the href and
 * that Cmd/Ctrl-click opens it, since a plain click on a link only places
 * the caret (`extensions/link-click.ts` gates real navigation behind that
 * modifier, so an in-place click can edit the text around a link instead
 * of leaving the page). Delegates `mouseover`/`mouseout` on the editor's
 * own DOM rather than wrapping each `<a>` in the shared `Tooltip`
 * component: the link mark and the button node view's link variant both
 * render as plain `<a>` tags TipTap/ProseMirror owns, not React elements
 * this component's caller controls.
 *
 * @module features/proposals/editor/link-hover-tooltip
 */
import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** The hovered link's href and on-screen position, or `null` when nothing is hovered. */
interface HoverState {
  href: string
  rect: DOMRect
}

/** Mounted once per `ContentSectionEditor`, scoped to that section's own editor DOM. */
export function LinkHoverTooltip({ editor }: { editor: Editor }) {
  const [hover, setHover] = useState<HoverState | null>(null)
  // The currently-hovered anchor element, so moving the pointer between a
  // link's own child nodes (a bolded word inside it) doesn't flicker the
  // tooltip closed and immediately back open.
  const currentLinkRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    const dom = editor.view.dom

    const onOver = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!link || !dom.contains(link) || link === currentLinkRef.current) return
      currentLinkRef.current = link
      setHover({ href: link.getAttribute('href') ?? '', rect: link.getBoundingClientRect() })
    }
    const onOut = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]')
      if (!link || link !== currentLinkRef.current) return
      const related = e.relatedTarget as Node | null
      if (related && link.contains(related)) return
      currentLinkRef.current = null
      setHover(null)
    }
    // Capture phase: the canvas viewport (not the editor DOM) is what
    // actually scrolls, so a bubble-phase listener on `dom` alone would
    // never see it move out from under a stationary pointer.
    const onScroll = () => {
      if (!currentLinkRef.current) return
      setHover((h) => (h ? { ...h, rect: currentLinkRef.current!.getBoundingClientRect() } : h))
    }

    dom.addEventListener('mouseover', onOver)
    dom.addEventListener('mouseout', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      dom.removeEventListener('mouseover', onOver)
      dom.removeEventListener('mouseout', onOut)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [editor])

  if (!hover || typeof document === 'undefined') return null

  return createPortal(
    <span
      role="tooltip"
      className="pointer-events-none fixed z-[140] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-control bg-text px-2 py-1 text-body font-medium text-text-inverse shadow-lg"
      style={{ top: hover.rect.top - 6, left: hover.rect.left + hover.rect.width / 2 }}
    >
      {hover.href}
      <span className="ml-1.5 text-text-inverse/70">⌘/Ctrl-click to open</span>
    </span>,
    document.body,
  )
}
