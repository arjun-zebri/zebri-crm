'use client'

import { useRef, useState } from 'react'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
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
      className={`group/asset relative ${populated ? '' : 'cursor-pointer'} ${className}`}
      style={style}
    >
      {populated ? children : emptyState}

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

      {populated && !busy && (
        <div
          className={`absolute z-10 flex items-center gap-1 opacity-0 group-hover/asset:opacity-100 transition ${
            overlayPosition === 'center'
              ? 'inset-0 items-center justify-center'
              : 'top-1.5 right-1.5'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-gray-900/90 text-white text-[11px] font-medium hover:bg-gray-900 cursor-pointer transition shadow-sm"
            title="Replace image"
          >
            <RefreshCw size={11} strokeWidth={2} />
            Replace
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => onClear()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 text-gray-700 hover:bg-white hover:text-red-600 cursor-pointer transition shadow-sm"
              title="Remove image"
            >
              <Trash2 size={11} strokeWidth={2} />
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
