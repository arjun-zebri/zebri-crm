'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { X } from 'lucide-react'
import { useRef } from 'react'

/** Min / max signature image width in px (keeps emails sensible). */
const MIN_W = 40
const MAX_W = 600

/**
 * In-editor view for a signature image: shows the image and, while it is
 * selected, a delete button plus a drag handle to resize it. The chosen
 * width is written back to the node's `width` attribute so it persists
 * into the rendered email.
 */
export function SignatureImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  // Drag the bottom-right handle to resize. Width is clamped and written
  // to the node attribute on every move so the change is live and saved.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const img = imgRef.current
    if (!img) return
    const startX = e.clientX
    const startWidth = img.offsetWidth
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_W, Math.min(MAX_W, startWidth + (ev.clientX - startX)))
      updateAttributes({ width: `${Math.round(next)}px` })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const width = typeof node.attrs.width === 'string' ? node.attrs.width : undefined
  // Reveal the controls on hover or when the node is selected; clicking an
  // image does not always create a NodeSelection, so hover is the reliable
  // affordance (and matches Gmail / Outlook).
  const controlsVisible = selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'

  return (
    <NodeViewWrapper className="group relative inline-block leading-none" data-drag-handle>
      {/* eslint-disable-next-line @next/next/no-img-element -- editor canvas image, not a Next-optimised asset */}
      <img
        ref={imgRef}
        src={String(node.attrs.src ?? '')}
        alt={String(node.attrs.alt ?? '')}
        style={{ width }}
        className={`max-w-full rounded-control ${selected ? 'ring-2 ring-blue-500' : ''}`}
      />
      <button
        type="button"
        title="Delete image"
        onClick={() => deleteNode()}
        className={`${controlsVisible} transition-opacity absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-pill bg-gray-900 text-white shadow cursor-pointer hover:bg-gray-700`}
      >
        <X size={14} strokeWidth={2} />
      </button>
      <span
        title="Drag to resize"
        onPointerDown={startResize}
        className={`${controlsVisible} transition-opacity absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-control bg-blue-500 border-2 border-white cursor-nwse-resize`}
      />
    </NodeViewWrapper>
  )
}
