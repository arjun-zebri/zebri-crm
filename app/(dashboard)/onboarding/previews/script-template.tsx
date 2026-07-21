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
      <div className="flex gap-3 h-full">
        <div className="w-24 sm:w-28 shrink-0 space-y-1.5">
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors duration-300 ${
              show(2) ? 'bg-brand-fg text-text-inverse' : 'border border-border text-text-subtle'
            }`}
          >
            <Plus size={10} strokeWidth={1.5} />
            New template
          </span>
          {show(7) && (
            <div className="rounded border border-border bg-surface-muted px-2 py-1 animate-fade-in">
              <p className="text-[10px] font-medium text-text truncate">Enquiry reply</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3 space-y-2">
          {show(3) && (
            <p className="text-xs font-medium text-text animate-fade-in">Enquiry reply</p>
          )}
          {show(4) && (
            <div className="animate-fade-in">
              <p className="text-[10px] text-text-subtle mb-0.5">Subject</p>
              <div className="rounded border border-border bg-surface px-2 py-1 text-xs text-text flex flex-wrap items-center gap-1">
                <span>Thanks for getting in touch,</span>
                {show(5) && (
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700 animate-fade-in">
                    {'{{couple.name}}'}
                  </span>
                )}
              </div>
            </div>
          )}
          {show(6) && (
            <div className="space-y-1 animate-fade-in">
              <div className="h-1.5 w-full rounded bg-surface-muted" />
              <div className="h-1.5 w-5/6 rounded bg-surface-muted" />
              <div className="h-1.5 w-2/3 rounded bg-surface-muted" />
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  )
}
