'use client'

import { Plus, Mail } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 New couple menu, 3 Add manually,
 * 4 name typed, 5 date typed, 6 Save pressed, 7 row lands.
 */
const BEATS = 8

/**
 * Preview for step 4: adding a couple.
 *
 * Shows a Kanban board with 4 status columns (New, Contacted, Confirmed, Paid).
 * The couple created here is the same one emailed in the step 6 preview, so the
 * four previews read as one story.
 */
export function ScriptCouple({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="couples" navClicked={show(1)}>
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
          <div>
            <span className="text-xl font-semibold text-text">Couples</span>
            <span className="text-xs text-text-muted ml-2">1 total</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors duration-300 cursor-pointer ${
              show(2) ? 'bg-brand-fg text-text-inverse' : 'border border-border text-text-subtle'
            }`}
          >
            <Plus size={12} strokeWidth={1.5} />
            <span className="hidden sm:inline">New couple</span>
          </span>
        </div>

        {show(2) && !show(3) && (
          <div className="absolute right-4 top-12 z-10 w-40 rounded-lg border border-border bg-card shadow-sm py-1 animate-fade-in">
            <p className="px-3 py-1.5 text-xs text-text font-medium cursor-pointer hover:bg-surface-muted">
              Add manually
            </p>
            <p className="px-3 py-1.5 text-xs text-text-muted cursor-pointer hover:bg-surface-muted">
              Import from CSV
            </p>
          </div>
        )}

        {show(3) && !show(7) && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-text">Add Couple</p>
            <MockField label="Name" value={show(4) ? 'Ellie & Tom' : ''} />
            <MockField label="Wedding date" value={show(5) ? '14 Mar 2027' : ''} />
            <div className="flex justify-end gap-2 pt-1">
              <span className="text-xs text-text-muted cursor-pointer">Cancel</span>
              <span
                className={`rounded-lg px-3 py-1 text-xs transition-colors duration-300 cursor-pointer ${
                  show(6) ? 'bg-brand-fg text-text-inverse' : 'bg-surface-muted text-text-subtle'
                }`}
              >
                Save
              </span>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
            {show(7) && (
              <div className="min-w-[140px] shrink-0 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-600">
                    New
                  </span>
                  <span className="text-[11px] text-text-subtle">1</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <p className="text-xs font-semibold text-text">Ellie &amp; Tom</p>
                  <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                    <Mail size={12} strokeWidth={1.5} />
                    <span>ellie@example.com</span>
                  </div>
                </div>
              </div>
            )}
            <div className="min-w-[140px] shrink-0 opacity-30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                  Contacted
                </span>
              </div>
              <div className="h-24 rounded-xl border border-dashed border-border" />
            </div>
            <div className="min-w-[140px] shrink-0 opacity-30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">
                  Confirmed
                </span>
              </div>
              <div className="h-24 rounded-xl border border-dashed border-border" />
            </div>
            <div className="min-w-[140px] shrink-0 opacity-30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-600">
                  Paid
                </span>
              </div>
              <div className="h-24 rounded-xl border border-dashed border-border" />
            </div>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}

/**
 * A miniature labelled field with a typing caret.
 */
function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-subtle mb-0.5">{label}</p>
      <div className="border-b border-border bg-transparent px-2 py-1.5 flex items-center">
        <span className="text-xs text-text">{value}</span>
        {!value && <span className="w-px h-3 bg-text-subtle animate-pulse" />}
      </div>
    </div>
  )
}
