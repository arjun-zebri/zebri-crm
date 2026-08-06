'use client'

import { useEffect, useRef, useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { FONT_STACKS, FONT_LABELS } from '@/lib/branding/fonts'
import type { BrandPreviewState } from '@/types/branding-preview'

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
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (openRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(defaultName)
      const t = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 60)
      return () => clearTimeout(t)
    }
  }, [defaultName])

  const trimmed = name.trim()
  const handleSave = () => {
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Save brand kit"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-control text-body font-medium text-gray-600 hover:text-text hover:bg-surface cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!trimmed}
            className="px-4 h-9 rounded-control bg-gray-900 hover:bg-black text-white text-body font-medium cursor-pointer transition disabled:bg-gray-200 disabled:text-text-subtle disabled:cursor-not-allowed"
          >
            Save kit
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-body text-text-muted">
          Capture this look, colours, fonts and assets, so you can switch back later.
        </p>

        <KitPreviewCard state={state} />

        <label className="block">
          <span className="text-body font-medium text-gray-700 mb-1.5 block">Kit name</span>
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
            placeholder="e.g. Sunset Studio, Autumn 2026"
            className="w-full px-3 py-2 text-body text-text placeholder-gray-400 border border-border rounded-control focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition"
          />
        </label>
      </div>
    </Modal>
  )
}

function KitPreviewCard({ state }: { state: BrandPreviewState }) {
  return (
    <div
      className="rounded-control border border-border p-4 flex items-center gap-4"
      style={{ background: state.surfaceColor }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-2xl leading-none"
          style={{
            fontFamily: FONT_STACKS[state.fontHeading],
            fontWeight: state.fontWeight,
            color: state.textColor,
            letterSpacing: -0.01,
          }}
        >
          Aa
        </p>
        <p
          className="text-caption mt-1.5 truncate"
          style={{
            fontFamily: FONT_STACKS[state.fontBody],
            color: state.textColor,
          }}
        >
          {FONT_LABELS[state.fontHeading]} · {FONT_LABELS[state.fontBody]}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="w-6 h-6 rounded-pill ring-1 ring-black/10" style={{ background: state.brandColor }} title="Primary" />
        <span className="w-6 h-6 rounded-pill ring-1 ring-black/10" style={{ background: state.headingColor }} title="Heading" />
        <span className="w-6 h-6 rounded-pill ring-1 ring-black/10" style={{ background: state.textColor }} title="Text" />
        <span className="w-6 h-6 rounded-pill ring-1 ring-black/10" style={{ background: state.secondaryColor }} title="Secondary" />
      </div>
    </div>
  )
}
