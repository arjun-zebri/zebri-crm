'use client'

import { Mail, Zap } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 empty canvas, 3 trigger chosen,
 * 4 connector draws, 5 action chosen, 6 toggled on.
 */
const BEATS = 7

/**
 * Preview for step 7: the automation that sends the template on its own.
 *
 * "New enquiry" and "Send email" are the real labels from
 * types/automations.ts and lib/automations/actions/ui.ts. A user who opens
 * the builder later should find the words they saw here.
 */
export function ScriptAutomation({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="automations" navClicked={show(1)}>
      <div className="h-full flex flex-col items-center justify-center gap-1">
        {show(2) && (
          <div
            className={`w-40 rounded-lg border bg-card px-2.5 py-2 flex items-center gap-2 transition-colors duration-300 ${
              show(3) ? 'border-brand-fg' : 'border-dashed border-border'
            }`}
          >
            <Zap size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-text-subtle">When</p>
              <p className="text-[11px] font-medium text-text truncate">
                {show(3) ? 'New enquiry' : 'Choose a trigger'}
              </p>
            </div>
          </div>
        )}

        {show(2) && (
          <div
            className={`w-px bg-border transition-all duration-500 ${show(4) ? 'h-6' : 'h-0'}`}
            aria-hidden
          />
        )}

        {show(4) && (
          <div
            className={`w-40 rounded-lg border bg-card px-2.5 py-2 flex items-center gap-2 animate-fade-in transition-colors duration-300 ${
              show(5) ? 'border-brand-fg' : 'border-dashed border-border'
            }`}
          >
            <Mail size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-text-subtle">Then</p>
              <p className="text-[11px] font-medium text-text truncate">
                {show(5) ? 'Send email' : 'Add action'}
              </p>
            </div>
          </div>
        )}

        {show(6) && (
          <div className="flex items-center gap-1.5 pt-3 animate-fade-in">
            <span className="h-3.5 w-6 rounded-full bg-brand-fg flex items-center justify-end px-0.5">
              <span className="h-2.5 w-2.5 rounded-full bg-card" />
            </span>
            <span className="text-[10px] text-text-muted">Live</span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
