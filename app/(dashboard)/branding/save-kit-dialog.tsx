'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'
import { FONT_STACKS, FONT_LABELS } from '@/lib/branding/fonts'
import type { BrandPreviewState } from './branding-preview-types'

interface SaveKitDialogProps {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
  defaultName: string
  state: BrandPreviewState
}

export function SaveKitDialog({ open, onClose, onSave, defaultName, state }: SaveKitDialogProps) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      setName(defaultName)
      // Defer to allow animation; focus + select for fast renaming
      const t = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 60)
      return () => clearTimeout(t)
    }
  }, [open, defaultName])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-in">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="savekit-title"
        className="relative w-[440px] max-w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero preview */}
        <div
          className="relative h-32 overflow-hidden"
          style={{ background: state.surfaceColor }}
        >
          <div className="absolute inset-0 flex items-end p-5">
            <div className="flex items-end gap-2">
              <span
                className="text-3xl leading-none"
                style={{
                  fontFamily: FONT_STACKS[state.fontHeading],
                  fontWeight: state.fontWeight,
                  color: state.textColor,
                  letterSpacing: -0.01,
                }}
              >
                Aa
              </span>
              <span
                className="text-base leading-tight"
                style={{
                  fontFamily: FONT_STACKS[state.fontBody],
                  color: state.mutedColor,
                }}
              >
                {FONT_LABELS[state.fontHeading]} · {FONT_LABELS[state.fontBody]}
              </span>
            </div>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <span className="w-6 h-6 rounded-full ring-2 ring-white shadow-sm" style={{ background: state.brandColor }} />
            <span className="w-6 h-6 rounded-full ring-2 ring-white shadow-sm" style={{ background: state.accentColor }} />
            <span className="w-6 h-6 rounded-full ring-2 ring-white shadow-sm" style={{ background: state.textColor }} />
            <span className="w-6 h-6 rounded-full ring-2 ring-white shadow-sm" style={{ background: state.mutedColor }} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 left-4 w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 cursor-pointer transition shadow-sm"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
              <Sparkles size={14} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 id="savekit-title" className="text-base font-semibold text-gray-900">Save brand kit</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Capture this look - colours, fonts, and assets - so you can swap back later.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.08em] mb-1.5 block">Kit name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              placeholder="e.g. Sunset Studio · Autumn 2026"
              className="w-full px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 focus:ring-4 focus:ring-gray-900/5 transition"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 h-9 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-medium cursor-pointer transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Save kit
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
