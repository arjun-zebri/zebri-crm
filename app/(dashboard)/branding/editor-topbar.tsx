'use client'

import * as Popover from '@radix-ui/react-popover'
import { Monitor, Smartphone, Undo2, Redo2, Eye, ChevronDown, Check, Trash2, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import type { SaveStatus } from '@/lib/branding/use-autosave'
import type { BrandKit } from '@/types/branding-preview'

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
  onCreateNewKit: () => void
  brandKits: BrandKit[]
  onApplyKit: (kit: BrandKit) => void
  onDeleteKit: (id: string) => void
  onRetry?: () => void
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
  onCreateNewKit,
  brandKits,
  onApplyKit,
  onDeleteKit,
  onRetry,
  addBlockSlot,
}: EditorTopbarProps) {
  return (
    <header className="flex items-center justify-between gap-3 h-12 px-3 border-b border-gray-100 bg-surface shrink-0">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <KitNameField value={kitName} onChange={setKitName} />
        <KitPicker
          kits={brandKits}
          onApply={onApplyKit}
          onDelete={onDeleteKit}
          onCreateNewKit={onCreateNewKit}
          currentName={kitName}
        />
      </div>

      <div className="hidden md:flex items-center bg-surface-emphasis rounded-control p-0.5">
        <button
          type="button"
          onClick={() => setDevice('desktop')}
          aria-label="Desktop preview"
          title="Desktop"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-control transition cursor-pointer ${
            device === 'desktop' ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-gray-700'
          }`}
        >
          <Monitor size={13} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setDevice('mobile')}
          aria-label="Mobile preview"
          title="Mobile"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-control transition cursor-pointer ${
            device === 'mobile' ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-gray-700'
          }`}
        >
          <Smartphone size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-1 justify-end">
        <SaveStatusPill status={saveStatus} onRetry={onRetry} />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-control transition ${
              canUndo
                ? 'text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer'
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
            className={`p-1.5 rounded-control transition ${
              canRedo
                ? 'text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            <Redo2 size={14} strokeWidth={1.75} />
          </button>
        </div>

        {addBlockSlot}

        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-control bg-gray-900 text-white text-body font-medium hover:bg-black cursor-pointer transition"
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

  if (editing) {
    return (
      <div className="flex items-center min-w-0">
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
          onFocus={(e) => e.currentTarget.select()}
          className="h-7 text-body font-medium text-text bg-surface border border-border-strong rounded-control px-2 focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 min-w-0 w-[220px]"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename brand kit"
      className="inline-flex items-center h-7 px-1.5 -ml-1.5 rounded-control hover:bg-surface-emphasis cursor-pointer transition min-w-0"
    >
      <span className="text-body font-medium text-text truncate max-w-[220px]">{value}</span>
    </button>
  )
}

function KitPicker({
  kits,
  onApply,
  onDelete,
  onCreateNewKit,
  currentName,
}: {
  kits: BrandKit[]
  onApply: (kit: BrandKit) => void
  onDelete: (id: string) => void
  onCreateNewKit: () => void
  currentName: string
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Switch brand kit"
          title="Switch brand kit"
          className="inline-flex items-center justify-center w-6 h-6 rounded-control text-text-subtle hover:text-text hover:bg-surface-emphasis cursor-pointer transition shrink-0"
        >
          <ChevronDown size={12} strokeWidth={2} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-surface border border-border rounded-control shadow-xl p-1.5 z-50 w-[260px] animate-modal-in"
        >
          <div className="px-2 pt-1 pb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-medium text-text-subtle uppercase tracking-[0.06em]">Saved kits</p>
            <span className="text-[10px] text-text-subtle">{kits.length}</span>
          </div>
          {kits.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-text-subtle">
              No saved kits yet. Save your current setup to switch back later.
            </p>
          ) : (
            <ul className="space-y-0.5 max-h-[260px] overflow-y-auto">
              {kits.map((kit) => {
                const active = kit.name === currentName
                return (
                  <li key={kit.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-control hover:bg-gray-50">
                    <span className="flex items-center gap-0.5 shrink-0">
                      <span className="w-3 h-3 rounded-pill ring-1 ring-black/5" style={{ background: kit.brandColor }} />
                      <span className="w-3 h-3 rounded-pill ring-1 ring-black/5" style={{ background: kit.headingColor }} />
                      <span className="w-3 h-3 rounded-pill ring-1 ring-black/5" style={{ background: kit.textColor }} />
                    </span>
                    <Popover.Close asChild>
                      <button
                        type="button"
                        onClick={() => onApply(kit)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                        title={`Apply ${kit.name}`}
                      >
                        <p className="text-body font-medium text-text truncate">{kit.name}</p>
                      </button>
                    </Popover.Close>
                    {active && <Check size={11} strokeWidth={2.5} className="text-text shrink-0" />}
                    {kits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDelete(kit.id)}
                        className="p-1 rounded-control text-text-subtle hover:text-red-600 hover:bg-red-50 cursor-pointer transition opacity-0 group-hover:opacity-100"
                        title="Delete kit"
                        aria-label="Delete kit"
                      >
                        <Trash2 size={11} strokeWidth={1.75} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-gray-100 mt-1.5 pt-1.5 space-y-0.5">
            <Popover.Close asChild>
              <button
                type="button"
                onClick={onCreateNewKit}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-control text-body text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <Plus size={11} strokeWidth={1.75} className="text-text-subtle" />
                Create new kit
              </button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Save status indicator with optional retry button on error.
 * Shows save status and provides a retry action when save fails.
 */
function SaveStatusPill({ status, onRetry }: { status: SaveStatus; onRetry?: () => void }) {
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
  const tone = status === 'error' ? 'text-red-600' : 'text-text-subtle'

  if (status === 'error' && onRetry) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${tone}`}>
          <span className={`w-1.5 h-1.5 rounded-pill shrink-0 ${dot}`} />
          <span className="truncate">{text}</span>
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="px-2 py-1 text-[11px] font-medium text-danger hover:text-danger hover:bg-danger/10 rounded-control cursor-pointer transition"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${tone}`}
      style={{ width: 96 }}
    >
      <span className={`w-1.5 h-1.5 rounded-pill shrink-0 ${dot}`} />
      <span className="truncate">{text}</span>
    </span>
  )
}
