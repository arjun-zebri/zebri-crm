'use client'

import { Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { useToast } from '@/components/ui/toast'

interface InlineAssetProps {
  value: string | null | undefined
  onUpload: (file: File) => Promise<void>
  onClear?: () => void | Promise<void>
  /** Rendered when populated. Receives the current asset URL. */
  children: React.ReactNode
  /** Rendered when empty (instead of children). */
  emptyState: React.ReactNode
  /** ARIA label for the upload input */
  label?: string
  /** Position of the Replace overlay button. Defaults to top-right. */
  overlayPosition?: 'top-right' | 'center'
  /**
   * When true, a click on the empty state does NOT open the file picker.
   * The click bubbles instead so the surrounding block can be selected (and
   * therefore deleted / reordered). Upload happens via the explicit "Upload"
   * button and drag-and-drop. Used for the deletable image block so an empty
   * image block never traps the user in the picker. Defaults to false, which
   * keeps the whole-area click-to-upload behaviour for logo / header assets.
   */
  selectableWhenEmpty?: boolean
  /**
   * Compact overlay: small icon-only Replace / Remove buttons pinned to the
   * top-right corner instead of the full-width labelled pill. Used for small
   * assets like the My-details logo, where the labelled overlay dominates the
   * mark. Defaults to false.
   */
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'

export function InlineAsset({
  value,
  onUpload,
  onClear,
  children,
  emptyState,
  label = 'Upload image',
  overlayPosition = 'top-right',
  selectableWhenEmpty = false,
  compact = false,
  className = '',
  style,
}: InlineAssetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const { toast } = useToast()
  const populated = !!value

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    setBusy(true)
    try {
      await onUpload(file)
    } catch (e) {
      // upload functions toast on size errors; only toast for unknown failures
      const msg = e instanceof Error ? e.message : ''
      if (msg !== 'size') toast('Upload failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    inputRef.current?.click()
  }

  return (
    <div
      onClick={(e) => {
        if (populated) return
        // Let the click bubble so the parent block can be selected (and thus
        // deleted / reordered). Upload is handled by the explicit button below.
        if (selectableWhenEmpty) return
        e.stopPropagation()
        openPicker()
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        setDragOver(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className={`group/asset relative ${populated || selectableWhenEmpty ? '' : 'cursor-pointer'} ${className}`}
      style={style}
    >
      {populated ? children : emptyState}

      {/*
        Empty deletable image block: only the small centred square opens the
        picker. Clicking anywhere else on the block bubbles up to select it (so
        it can be deleted / reordered), because the overlay is pointer-events-none
        and only the square button re-enables pointer events.
      */}
      {!populated && selectableWhenEmpty && !busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={openPicker}
            aria-label={label}
            title="Upload image"
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-lg border border-gray-300 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-400 cursor-pointer transition shadow-sm"
          >
            <Upload size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {dragOver && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-md bg-gray-900/10 ring-2 ring-gray-900/40 ring-inset pointer-events-none flex items-center justify-center"
        >
          <span className="text-xs font-medium text-gray-900 bg-white/95 rounded px-2 py-1 shadow-sm">
            Drop to upload
          </span>
        </div>
      )}

      {busy && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-md bg-white/60 pointer-events-none flex items-center justify-center"
        >
          <Loader2 size={16} className="animate-spin text-gray-700" />
        </div>
      )}

      {populated && !busy && compact && (
        // Compact: icon-only controls float just above the mark (never over it),
        // so a small logo is never obscured. Icon-only, so the tooltips are
        // informative, not redundant.
        <div
          className="absolute z-10 bottom-full left-0 mb-1 flex items-center gap-1 opacity-0 group-hover/asset:opacity-100 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-900/90 text-white hover:bg-gray-900 cursor-pointer transition shadow-sm"
            title="Replace"
            aria-label="Replace"
          >
            <RefreshCw size={11} strokeWidth={1.5} />
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => onClear()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/90 text-gray-700 hover:bg-white hover:text-red-600 cursor-pointer transition shadow-sm"
              title="Remove"
              aria-label="Remove"
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {populated && !busy && !compact && (
        <div
          className={`absolute z-10 flex items-center gap-1 opacity-0 group-hover/asset:opacity-100 transition ${
            overlayPosition === 'center'
              ? 'inset-0 items-center justify-center'
              : 'top-1.5 right-1.5'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Visible "Replace" label makes a native title redundant, so none here. */}
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-gray-900/90 text-white text-[11px] font-medium hover:bg-gray-900 cursor-pointer transition shadow-sm"
          >
            <RefreshCw size={11} strokeWidth={1.5} />
            Replace
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => onClear()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 text-gray-700 hover:bg-white hover:text-red-600 cursor-pointer transition shadow-sm"
              title="Remove"
              aria-label="Remove"
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}


      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </div>
  )
}
