'use client'

import { Minus, Plus, Maximize2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame'

import { Slider } from './slider'

/**
 * The zoomable, pannable canvas viewport documents render into. Moved from
 * the Branding editor (Proposal Layout v2 Phase 2, spec 5.3) so the
 * proposal section editor shares the same pan/zoom/fit behaviour instead of
 * a second implementation drifting from it.
 *
 * @module components/editor/canvas-frame
 */

/** The two device widths a canvas can preview at. */
export type CanvasDevice = 'desktop' | 'mobile'

/** Props for {@link CanvasFrame}. */
export interface CanvasFrameProps {
  device: CanvasDevice
  zoom: number
  setZoom: (v: number) => void
  wide?: boolean
  /** The proposal surface: a full-bleed page frame rather than a document card. */
  page?: boolean
  children: React.ReactNode
  /** Floating overlay pinned inside the canvas (e.g. the readiness badge, or
   *  the proposal editor's section/node control bar - Proposal Layout v2
   *  Phase 2 Task 14). It positions itself; render it as a sibling of the
   *  scroll area so it stays put while the document scrolls, like the zoom
   *  widget. */
  overlay?: React.ReactNode
  /**
   * Ref to the scroll viewport (the element with `data-canvas-scroll`).
   * Optional: a caller that only renders `children`/`overlay` never needs
   * it, but a control bar rendered through `overlay` needs the real scroll
   * element as a Radix popover `collisionBoundary` so its popovers stay
   * inside the canvas instead of colliding against the page chrome (the
   * proposal editor's section bar - Proposal Layout v2 Phase 2 Task 14).
   */
  scrollRef?: RefObject<HTMLDivElement | null>
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.5

/** Round to a sane 2dp step so the readout never shows float noise. */
function clampZoom(v: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 100) / 100))
}

/** Widest the fluid page canvas gets: the 1100px content column plus a 50px background bleed a side. */
const PAGE_MAX_WIDTH = 1200
/** Narrowest the fluid page canvas gets before the fit zoom scales it instead. */
const PAGE_MIN_WIDTH = 720

/** A zoomable, pannable canvas: dotted backdrop, centred content, fit-to-width and cursor-anchored zoom. */
export function CanvasFrame({ device, zoom, setZoom, wide, page, children, overlay, scrollRef: externalScrollRef }: CanvasFrameProps) {
  // Portal uses a wider surface (it's a real-app dashboard preview); documents
  // stay narrower and identical across quote / invoice / contract. The page
  // canvas is wider still than the 1100px column so section backgrounds
  // visibly bleed past the content while editing, but only by 50px a side:
  // at 1280 it was a hair wider than the canvas viewport on a common
  // editor layout, so "100%" cropped the page edges behind a scrollbar.
  // The page canvas is fluid: it takes the viewport's usable width (720 to
  // 1200px) at 100% and reflows, like the public page on a real screen.
  // A fixed 1200px page auto-fitted to ~69% on a laptop, which shrank every
  // piece of editing chrome inside the sheet (section toolbars, name tags,
  // the text bar) along with it. `PAGE_MAX_WIDTH` keeps section backgrounds
  // bleeding 50px past the 1100px content column on wide screens.
  const [pageWidth, setPageWidth] = useState(PAGE_MAX_WIDTH)
  const desktopWidth = page ? pageWidth : wide ? 920 : DOC_MAX_WIDTH_PX

  // The scroll viewport. Pan writes directly to its scrollLeft/scrollTop, and
  // cursor-anchored zoom reads its scroll + rect to keep the point under the
  // pointer fixed while the scale changes. Always this component's own
  // `useRef` (not the caller-supplied `scrollRefProp` directly): every
  // effect below reads `scrollRef` without listing it as a dependency,
  // which only the React Hooks lint rule accepts for a ref it can prove is
  // `useRef`-stable - a `scrollRefProp ?? internalScrollRef` expression is
  // a new value each render as far as that static check is concerned, even
  // though both branches are themselves stable. `setScrollRef` below
  // forwards the DOM node to `externalScrollRef` too, so a caller-supplied
  // ref still sees the live element.
  const scrollRef = useRef<HTMLDivElement>(null)
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node
    if (externalScrollRef) externalScrollRef.current = node
  }, [externalScrollRef])
  // The padded wrapper inside the scroll viewport. Measured (not the zoomed
  // child) because it is outside the `zoom` property's coordinate space, so
  // its padding stays in real pixels whatever the zoom is.
  const padRef = useRef<HTMLDivElement>(null)
  // The zoom at which the canvas exactly fills the viewport's usable width.
  // Capped at 1: fitting is for canvases too wide to show, never an excuse to
  // magnify a narrow document past its true size.
  const [fitZoom, setFitZoom] = useState(1)
  // True while space is held: the cursor becomes a grab handle and a primary
  // drag pans instead of selecting. Middle-mouse drag pans without the key.
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)

  // Measure the fit zoom whenever the viewport or the target canvas width
  // changes. A ResizeObserver rather than a window listener, since the editor's
  // side panels collapse and expand without the window ever resizing.
  // Canvas width the auto-fit has already been applied for, so switching
  // surfaces re-fits once and a zoom the MC then chooses is never overridden.
  const fittedFor = useRef<number | null>(null)
  useLayoutEffect(() => {
    const viewport = scrollRef.current
    const pad = padRef.current
    if (!viewport || !pad) return
    const measure = () => {
      const style = getComputedStyle(pad)
      // `|| 0`: an environment with no computed padding (jsdom) reports '',
      // and a NaN here silently turned every fit into `null`.
      const available =
        viewport.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (available <= 0) return
      if (page) setPageWidth(Math.max(PAGE_MIN_WIDTH, Math.min(PAGE_MAX_WIDTH, Math.floor(available))))
      // A fluid page fits by construction; below its minimum width the fit
      // zoom still shrinks it rather than overflow.
      const fit = page
        ? Math.min(1, Math.round((available / PAGE_MIN_WIDTH) * 100) / 100)
        : Math.min(1, Math.round((available / desktopWidth) * 100) / 100)
      setFitZoom(fit)
      // Apply the fit here, off a real measurement, rather than in a separate
      // effect: `fitZoom` still holds the previous canvas's value on the first
      // render after a surface change, so an effect keyed on it would mark this
      // width as fitted using a stale number and never correct itself.
      // Keyed on the mode's nominal width (the page's fluid width changes on
      // every resize and must not re-apply the fit each time).
      const fitKey = page ? PAGE_MAX_WIDTH : desktopWidth
      if (fittedFor.current !== fitKey) {
        fittedFor.current = fitKey
        setZoom(clampZoom(fit))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [desktopWidth, page, setZoom])

  // Latest zoom, read inside the native wheel listener below without making it
  // a dependency (so the listener attaches once and never detaches mid-gesture).
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // The cursor anchor captured at wheel time, consumed once the zoom has been
  // applied to the DOM. Held in a ref so the layout effect can read the exact
  // pre-zoom scroll + pointer position that produced the new zoom value.
  const pendingZoom = useRef<{
    clientX: number
    clientY: number
    rectLeft: number
    rectTop: number
    scrollLeft: number
    scrollTop: number
    fromZoom: number
  } | null>(null)

  // Zoom on ctrl/⌘ + wheel, and on trackpad pinch (browsers deliver a pinch as a
  // ctrlKey wheel event). Attached as a NON-passive native listener rather than
  // React's onWheel: React registers wheel handlers passively, so its
  // preventDefault() is ignored and the whole browser page zooms instead: that
  // was the "zooms the entire page" bug. A native { passive: false } listener is
  // the only way preventDefault actually suppresses browser zoom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const current = zoomRef.current
      // deltaY is larger for mouse wheels than trackpads; the 0.01 factor keeps
      // both feeling proportional rather than jumpy.
      const next = clampZoom(current - e.deltaY * 0.01)
      if (next === current) return
      const rect = el.getBoundingClientRect()
      // Record the anchor and let the layout effect below correct the scroll
      // synchronously once React has applied the new zoom. Doing the correction
      // in requestAnimationFrame (after paint) left one frame where the zoom had
      // changed but the scroll had not, and that visible jump was the "shake".
      pendingZoom.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        fromZoom: current,
      }
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  // Cursor-anchored scroll correction, run after the DOM has the new zoom but
  // BEFORE the browser paints, so the point under the pointer stays fixed and
  // there is no intermediate frame to shake.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const p = pendingZoom.current
    if (!el || !p) return
    pendingZoom.current = null
    const ratio = zoom / p.fromZoom
    const offsetX = p.clientX - p.rectLeft
    const offsetY = p.clientY - p.rectTop
    el.scrollLeft = (p.scrollLeft + offsetX) * ratio - offsetX
    el.scrollTop = (p.scrollTop + offsetY) * ratio - offsetY
  }, [zoom])

  // Space toggles pan mode. Ignore repeats and typing in editable fields so the
  // canvas never hijacks a spacebar meant for a text block or input.
  useEffect(() => {
    const isEditingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.isContentEditable || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditingTarget(e.target)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Pan with a pointer drag. Enabled when space is held (primary button) or on
  // middle-button drag. Uses pointer capture so a fast drag that leaves the
  // element keeps panning until release.
  const panOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    const middle = e.button === 1
    if (!spaceHeld && !middle) return
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    panOrigin.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    setPanning(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const el = scrollRef.current
    const origin = panOrigin.current
    if (!el || !origin) return
    el.scrollLeft = origin.left - (e.clientX - origin.x)
    el.scrollTop = origin.top - (e.clientY - origin.y)
  }
  const endPan = (e: React.PointerEvent) => {
    if (!panOrigin.current) return
    scrollRef.current?.releasePointerCapture(e.pointerId)
    panOrigin.current = null
    setPanning(false)
  }

  const panCursor = panning ? 'grabbing' : spaceHeld ? 'grab' : undefined

  return (
    <div
      className={`relative flex-1 min-h-0 overflow-hidden ${page ? 'bg-surface-emphasis' : ''}`}
      // The document/Branding-editor workbench keeps its own fixed grey
      // (`DOC_CANVAS_BG`) via inline style; the proposal page canvas uses
      // the cooler `bg-surface-emphasis` token class instead (UX audit
      // §3.10: the old grey "read warm and muddy behind the beige default
      // page"). `surface-muted` is too close to a white sheet to separate
      // the two; `surface-emphasis` is the lightest token that still does.
      style={page ? undefined : { backgroundColor: DOC_CANVAS_BG }}
    >
      {/* Subtle dotted backdrop, ala Canva / Figma - the page canvas skips
          it: the sheet itself (`page-sheet.tsx`) now supplies the "this is
          a document" read, and the dots showed through a page with no
          section background, competing with the sheet's own edge. */}
      {page ? null : (
        <div
          data-canvas-dots
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(15,23,42,0.08) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
      )}

      <div
        ref={setScrollRef}
        // The block toolbar's collision boundary (see BlockFrame): it keeps
        // the toolbar inside the canvas rather than over the surface tabs.
        data-canvas-scroll
        className="relative h-full overflow-y-auto overflow-x-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        style={panCursor ? { cursor: panCursor } : undefined}
      >
        {/* `min-w-fit` keeps the centred child reachable when it is wider than
            the viewport: a plain `justify-center` would push its left edge
            out of the scrollable area. */}
        <div ref={padRef} className="min-w-fit mx-auto px-6 lg:px-12 pt-12 pb-24 flex justify-center">
          <div
            // Use the `zoom` CSS property (not transform: scale) so dnd-kit's
            // pointer geometry stays correct while dragging. `shrink-0` so the
            // flex parent cannot squeeze the zoomed canvas back down: without
            // it, zooming IN re-fit the canvas to the parent and looked like a
            // dead button, while zooming out appeared to work.
            className="shrink-0"
            style={{ zoom }}
          >
            {device === 'mobile' ? (
              <div className="w-[380px] @container/doc">{children}</div>
            ) : (
              <div style={{ width: desktopWidth }} className="@container/doc">{children}</div>
            )}
          </div>
        </div>
      </div>

      {overlay}

      <ZoomWidget zoom={zoom} fitZoom={fitZoom} setZoom={(v) => setZoom(clampZoom(v))} />
    </div>
  )
}

function ZoomWidget({ zoom, fitZoom, setZoom }: { zoom: number; fitZoom: number; setZoom: (v: number) => void }) {
  const pct = Math.round(zoom * 100)
  return (
    // Centred on the canvas rather than tucked into a corner: it belongs to the
    // document, not to the page chrome. Centring also clears the assistant
    // dock (fixed at `bottom-6 right-6` on every dashboard page) without
    // having to dodge its exact footprint, which is what the old `right-40`
    // was doing. `bottom-6` keeps the two on one baseline, `h-8` one height.
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-surface border border-border rounded-pill shadow-[0_4px_18px_-4px_rgba(15,23,42,0.18)] h-8 px-1">
      <button
        type="button"
        onClick={() => setZoom(zoom - 0.1)}
        className="w-6 h-6 inline-flex items-center justify-center rounded-pill text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer transition"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={12} strokeWidth={2} />
      </button>
      <div className="w-28 px-1">
        <Slider value={zoom} min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} onChange={setZoom} ariaLabel="Zoom" />
      </div>
      <button
        type="button"
        onClick={() => setZoom(zoom + 0.1)}
        className="w-6 h-6 inline-flex items-center justify-center rounded-pill text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer transition"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
      <span className="text-[11px] font-mono text-gray-700 tabular-nums w-10 text-center">{pct}%</span>
      <button
        type="button"
        // Its label always said "Fit to width" while it reset to a literal
        // 100%, which on the proposal's 1200px page frame can be wider than the
        // viewport: the control that promised to show the whole canvas was the
        // one cropping it.
        onClick={() => setZoom(fitZoom)}
        className="w-6 h-6 inline-flex items-center justify-center rounded-pill text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer transition"
        aria-label="Fit to width"
        title="Fit to width"
      >
        <Maximize2 size={11} strokeWidth={2} />
      </button>
    </div>
  )
}
