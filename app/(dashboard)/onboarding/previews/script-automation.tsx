'use client'

import { Mail, ChevronLeft, UserPlus } from 'lucide-react'

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
      <div className="h-full flex flex-col">
        {show(2) && (
          <div className="hidden sm:flex items-center justify-between pb-2 border-b border-border animate-fade-in">
            <div className="flex items-center gap-2">
              <ChevronLeft size={16} strokeWidth={1.5} className="text-text-subtle cursor-pointer" />
              <span className="text-sm font-semibold text-text">Enquiry auto-reply</span>
              {show(6) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium animate-fade-in">
                  Active
                </span>
              )}
              {show(2) && !show(6) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-text-muted font-medium">
                  Paused
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-subtle">Saved · just now</span>
          </div>
        )}

        {show(2) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 sm:gap-4 pt-1 sm:pt-4">
            {show(2) && (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold text-text-subtle uppercase tracking-wider mb-1.5 sm:mb-3">
                  Trigger
                </p>
                <div className={`w-48 rounded-xl bg-card border-2 px-3 py-2 flex items-start gap-2 transition-colors duration-300 ${
                  show(3) ? 'border-brand-fg' : 'border-dashed border-border'
                }`}>
                  <UserPlus size={14} strokeWidth={1.5} className="text-text shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text">New enquiry</p>
                    <p className="text-[10px] text-text-subtle">When a couple is added to your CRM</p>
                  </div>
                </div>
              </div>
            )}

            {show(2) && show(4) && (
              <div
                className={`w-px bg-border transition-all duration-500 ${show(4) ? 'h-3 sm:h-5' : 'h-0'}`}
                aria-hidden
              />
            )}

            {show(4) && (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold text-text-subtle uppercase tracking-wider mb-1.5 sm:mb-3">
                  Action
                </p>
                <div className={`w-48 rounded-xl bg-card border-2 px-3 py-2 flex items-start gap-2 transition-colors duration-300 ${
                  show(5) ? 'border-brand-fg' : 'border-dashed border-border'
                }`}>
                  <Mail size={14} strokeWidth={1.5} className="text-text shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text">Send email</p>
                    <p className="text-[10px] text-text-subtle">Enquiry reply</p>
                  </div>
                </div>
              </div>
            )}

            {show(6) && (
              <div className="flex items-center gap-1.5 pt-0 sm:pt-2 animate-fade-in">
                <span className="h-3.5 w-6 rounded-full bg-green-600 flex items-center justify-end px-0.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-card" />
                </span>
                <span className="text-xs text-text font-medium">Active</span>
              </div>
            )}
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
