'use client'

import { Minus, Plus, Maximize2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Slider } from './components/slider'

interface CanvasFrameProps {
  device: 'desktop' | 'mobile'
  zoom: number
  setZoom: (v: number) => void
  wide?: boolean
  children: React.ReactNode
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.5

/** Round to a sane 2dp step so the readout never shows float noise. */
function clampZoom(v: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 100) / 100))
}

export function CanvasFrame({ device, zoom, setZoom, wide, children }: CanvasFrameProps) {
  // Portal uses a wider surface (it's a real-app dashboard preview); documents
  // stay narrower and identical across quote / invoice / contract.
  const desktopWidth = wide ? 920 : 720

  // The scroll viewport. Pan writes directly to its scrollLeft/scrollTop, and
  // cursor-anchored zoom reads its scroll + rect to keep the point under the
  // pointer fixed while the scale changes.
  const scrollRef = useRef<HTMLDivElement>(null)
  // True while space is held: the cursor becomes a grab handle and a primary
  // drag pans instead of selecting. Middle-mouse drag pans without the key.
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)

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
  // preventDefault() is ignored and the whole browser page zooms instead — which
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
      // changed but the scroll had not — that visible jump was the "shake".
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
  // BEFORE the browser paints — so the point under the pointer stays fixed and
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
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#F4F4F1]">
      {/* Subtle dotted backdrop, ala Canva / Figma */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(15,23,42,0.08) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      <div
        ref={scrollRef}
        className="relative h-full overflow-y-auto overflow-x-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        style={panCursor ? { cursor: panCursor } : undefined}
      >
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-12 pb-24 flex justify-center">
          <div
            // Use the `zoom` CSS property (not transform: scale) so dnd-kit's
            // pointer geometry stays correct while dragging.
            style={{ zoom }}
          >
            {device === 'mobile' ? (
              <div className="w-[380px] @container/doc">{children}</div>
            ) : (
              <div style={{ width: desktopWidth }} className="max-w-full @container/doc">{children}</div>
            )}
          </div>
        </div>
      </div>

      <ZoomWidget zoom={zoom} setZoom={(v) => setZoom(clampZoom(v))} />
    </div>
  )
}

function ZoomWidget({ zoom, setZoom }: { zoom: number; setZoom: (v: number) => void }) {
  const pct = Math.round(zoom * 100)
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full shadow-[0_4px_18px_-4px_rgba(15,23,42,0.18)] pl-1 pr-1 py-1">
      <button
        type="button"
        onClick={() => setZoom(zoom - 0.1)}
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
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
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
      <span className="text-[11px] font-mono text-gray-700 tabular-nums w-10 text-center">{pct}%</span>
      <button
        type="button"
        onClick={() => setZoom(1)}
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
        aria-label="Fit to width"
        title="Reset zoom"
      >
        <Maximize2 size={11} strokeWidth={2} />
      </button>
    </div>
  )
}
