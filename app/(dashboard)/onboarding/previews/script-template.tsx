'use client'

import { Plus } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 New template, 3 name typed,
 * 4 subject typed, 5 variable chip resolves, 6 body fills, 7 saved.
 */
const BEATS = 8

/**
 * Preview for step 5: writing a reusable email template.
 *
 * The variable chip is the point of this preview, so it gets its own beat
 * rather than appearing as part of the subject line.
 */
export function ScriptTemplate({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="templates" navClicked={show(1)}>
      <div className="flex flex-col h-full gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-xl font-semibold text-text">Templates</span>
          <button
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors duration-300 cursor-pointer ${
              show(2) ? 'bg-black text-white' : 'border border-border text-text-subtle'
            }`}
          >
            <Plus size={12} strokeWidth={1.5} />
            <span className="hidden sm:inline">New template</span>
          </button>
        </div>

        {show(2) && (
          <div className="flex gap-2 border-b border-border pb-1 animate-fade-in">
            <span className="text-xs font-medium text-text border-b-2 border-black pb-1">Emails</span>
            <span className="text-xs text-text-subtle">Packages</span>
            <span className="text-xs text-text-subtle">Invoices</span>
          </div>
        )}

        <div className="flex-1 min-w-0 flex gap-3 overflow-hidden">
          {show(2) && (
            <div className="w-32 sm:w-40 shrink-0 space-y-2 overflow-y-auto pr-1 animate-fade-in">
              <p className="text-[10px] font-medium text-text-subtle uppercase">Uncategorised</p>
              {show(7) && (
                <div className="rounded-lg border border-border bg-card p-2 cursor-pointer hover:bg-surface-muted transition">
                  <p className="text-[10px] font-medium text-text truncate">Enquiry reply</p>
                </div>
              )}
            </div>
          )}

          {show(2) && (
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3 space-y-2 flex flex-col">
              {show(3) && (
                <div className="animate-fade-in">
                  <p className="text-xs font-medium text-text">Enquiry reply</p>
                  <p className="text-[10px] text-text-subtle">Edited just now</p>
                </div>
              )}
              {show(4) && (
                <div className="animate-fade-in space-y-1.5">
                  <div>
                    <p className="text-[10px] text-text-subtle font-medium mb-1">Subject</p>
                    <div className="text-xs text-text flex flex-wrap items-center gap-1">
                      <span>Thanks for getting in touch,</span>
                      {show(5) && (
                        <span
                          className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 animate-fade-in"
                          data-testid="couple-name-chip"
                        >
                          Couple display name
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {show(6) && (
                <div className="space-y-2 animate-fade-in flex-1">
                  <div className="h-1.5 w-full rounded bg-surface-muted" />
                  <div className="h-1.5 w-5/6 rounded bg-surface-muted" />
                  <div className="h-1.5 w-2/3 rounded bg-surface-muted" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  )
}
