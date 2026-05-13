'use client'

import { Minus, Plus, Maximize2 } from 'lucide-react'
import { Slider } from './components/slider'

interface CanvasFrameProps {
  device: 'desktop' | 'mobile'
  zoom: number
  setZoom: (v: number) => void
  wide?: boolean
  children: React.ReactNode
}

export function CanvasFrame({ device, zoom, setZoom, wide, children }: CanvasFrameProps) {
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

      <div className="relative h-full overflow-y-auto overflow-x-auto">
        <div className={`${wide ? 'max-w-[1100px]' : 'max-w-3xl'} mx-auto px-6 lg:px-12 pt-12 pb-24 flex justify-center`}>
          <div
            // Use the `zoom` CSS property (not transform: scale) so dnd-kit's
            // pointer geometry stays correct while dragging.
            style={{ zoom }}
          >
            {device === 'mobile' ? (
              <MobileBezel>{children}</MobileBezel>
            ) : (
              <div className={wide ? 'w-[920px] max-w-full' : 'max-w-2xl'}>{children}</div>
            )}
          </div>
        </div>
      </div>

      <ZoomWidget zoom={zoom} setZoom={setZoom} />
    </div>
  )
}

function MobileBezel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative bg-gray-900 rounded-[2.25rem] p-2.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
      style={{ width: 380 }}
    >
      {/* Notch */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 w-24 h-5 bg-gray-900 rounded-b-2xl flex items-center justify-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
        <span className="w-1 h-1 rounded-full bg-gray-700" />
      </div>
      <div className="bg-white rounded-[1.75rem] overflow-hidden pt-6">
        {children}
      </div>
    </div>
  )
}

function ZoomWidget({ zoom, setZoom }: { zoom: number; setZoom: (v: number) => void }) {
  const pct = Math.round(zoom * 100)
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full shadow-[0_4px_18px_-4px_rgba(15,23,42,0.18)] pl-1 pr-1 py-1">
      <button
        type="button"
        onClick={() => setZoom(Math.max(0.5, parseFloat((zoom - 0.1).toFixed(2))))}
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={12} strokeWidth={2} />
      </button>
      <div className="w-28 px-1">
        <Slider value={zoom} min={0.5} max={1.5} step={0.05} onChange={setZoom} ariaLabel="Zoom" />
      </div>
      <button
        type="button"
        onClick={() => setZoom(Math.min(1.5, parseFloat((zoom + 0.1).toFixed(2))))}
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
