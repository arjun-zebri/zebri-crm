'use client'

import { useRef, useState } from 'react'
import { Monitor, Smartphone, Undo2, Redo2, Eye, Sparkles, MoreHorizontal, RotateCcw } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import type { SaveStatus } from '@/lib/branding/use-autosave'

interface EditorTopbarProps {
  kitName: string
  setKitName: (v: string) => void
  device: 'desktop' | 'mobile'
  setDevice: (d: 'desktop' | 'mobile') => void
  saveStatus: SaveStatus
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPreview: () => void
  onResetSurface: () => void
  onSaveAsKit: () => void
  addBlockSlot?: React.ReactNode
}

export function EditorTopbar({
  kitName,
  setKitName,
  device,
  setDevice,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onResetSurface,
  onSaveAsKit,
  addBlockSlot,
}: EditorTopbarProps) {
  return (
    <header className="flex items-center justify-between gap-3 h-12 px-3 border-b border-gray-100 bg-white shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <KitNameField value={kitName} onChange={setKitName} />
      </div>

      <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setDevice('desktop')}
          aria-label="Desktop preview"
          title="Desktop"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition cursor-pointer ${
            device === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Monitor size={13} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setDevice('mobile')}
          aria-label="Mobile preview"
          title="Mobile"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition cursor-pointer ${
            device === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Smartphone size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-1 justify-end">
        <SaveStatusPill status={saveStatus} />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition ${
              canUndo
                ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <Undo2 size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition ${
              canRedo
                ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            <Redo2 size={14} strokeWidth={1.75} />
          </button>
        </div>

        <span className="w-px h-5 bg-gray-200" />

        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
              aria-label="More actions"
              title="More"
            >
              <MoreHorizontal size={14} strokeWidth={1.75} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={4}
              className="bg-white border border-gray-200 rounded-xl shadow-xl p-1 z-50 min-w-[200px]"
            >
              <Popover.Close asChild>
                <button
                  type="button"
                  onClick={onSaveAsKit}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <Sparkles size={13} strokeWidth={1.75} className="text-gray-400" />
                  Save as brand kit…
                </button>
              </Popover.Close>
              <Popover.Close asChild>
                <button
                  type="button"
                  onClick={onResetSurface}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <RotateCcw size={13} strokeWidth={1.75} className="text-gray-400" />
                  Reset this document
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {addBlockSlot}

        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-black cursor-pointer transition"
        >
          <Eye size={12} strokeWidth={2} />
          Preview
        </button>
      </div>
    </header>
  )
}

function KitNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  const [shadow, setShadow] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!editing && shadow !== value) {
    setShadow(value)
    setLocal(value)
  }

  const commit = () => {
    const trimmed = local.trim() || 'My brand'
    if (trimmed !== value) onChange(trimmed)
    setLocal(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex items-center min-w-0">
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              setLocal(value)
              setEditing(false)
            }
          }}
          className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:border-gray-900 focus:outline-none px-1 min-w-0 w-[220px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-gray-900 hover:bg-gray-50 px-1.5 py-0.5 -mx-1.5 rounded-md cursor-pointer truncate max-w-[260px] transition"
          title="Rename brand kit"
        >
          {value}
        </button>
      )}
    </div>
  )
}

function SaveStatusPill({ status }: { status: SaveStatus }) {
  const text =
    status === 'saving' ? 'Saving…' :
    status === 'error' ? 'Save failed' :
    status === 'saved' ? 'Saved' :
    'Auto-save on'
  const dot =
    status === 'saving' ? 'bg-gray-300 animate-pulse' :
    status === 'error' ? 'bg-red-500' :
    status === 'saved' ? 'bg-emerald-500' :
    'bg-gray-300'
  const tone = status === 'error' ? 'text-red-600' : 'text-gray-400'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${tone}`}
      style={{ width: 96 }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="truncate">{text}</span>
    </span>
  )
}
