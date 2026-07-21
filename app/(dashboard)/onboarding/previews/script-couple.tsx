'use client'

import { Plus } from 'lucide-react'

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
 * Real labels, invented data. The couple created here is the same one
 * emailed in the step 6 preview, so the four previews read as one story.
 */
export function ScriptCouple({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="couples" navClicked={show(1)}>
      <div className="relative h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text">Couples</span>
          <span
            className={`inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors duration-300 ${
              show(2) ? 'bg-brand-fg text-text-inverse border-transparent' : 'text-text-subtle'
            }`}
          >
            <Plus size={12} strokeWidth={1.5} />
            New couple
          </span>
        </div>

        {show(2) && !show(3) && (
          <div className="absolute right-0 top-9 z-10 w-32 rounded-lg border border-border bg-card shadow-sm py-1 animate-fade-in">
            <p className="px-2 py-1 text-xs text-text font-medium">Add manually</p>
            <p className="px-2 py-1 text-xs text-text-subtle">Import from CSV</p>
          </div>
        )}

        {show(3) && !show(7) && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-text">Add couple</p>
            <MockField label="Name" value={show(4) ? 'Ellie & Tom' : ''} />
            <MockField label="Wedding date" value={show(5) ? '14 Mar 2027' : ''} />
            <div className="flex justify-end pt-1">
              <span
                className={`rounded-lg px-3 py-1 text-xs transition-colors duration-300 ${
                  show(6) ? 'bg-brand-fg text-text-inverse' : 'bg-surface-muted text-text-subtle'
                }`}
              >
                Save
              </span>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between animate-fade-in">
            <div>
              <p className="text-xs font-medium text-text">Ellie &amp; Tom</p>
              <p className="text-[10px] text-text-subtle">14 Mar 2027</p>
            </div>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-text-muted">
              Enquiry
            </span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}

/** A miniature labelled field with a typing caret. */
function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-subtle mb-0.5">{label}</p>
      <div className="h-6 rounded border border-border bg-surface px-2 flex items-center">
        <span className="text-xs text-text">{value}</span>
        {!value && <span className="w-px h-3 bg-text-subtle animate-pulse" />}
      </div>
    </div>
  )
}
