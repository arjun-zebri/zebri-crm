'use client'

import { Mail } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 couple opened, 3 Emails tab,
 * 4 Send email pressed, 5 template picked, 6 send modal, 7 sent row.
 */
const BEATS = 8

/**
 * Preview for step 6: sending the template to the couple.
 *
 * Reuses the names from previews 4 and 5 on purpose. Seeing "Ellie & Tom"
 * receive "Enquiry reply" is what makes the four previews one story rather
 * than four disconnected demos.
 */
export function ScriptSend({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="couples" navClicked={show(1)}>
      <div className="relative h-full space-y-2">
        {show(2) && (
          <p className="text-sm font-medium text-text animate-fade-in">Ellie &amp; Tom</p>
        )}

        {show(3) && (
          <div className="flex gap-3 border-b border-border pb-1 animate-fade-in">
            <span className="text-[10px] text-text-subtle">Overview</span>
            <span className="text-[10px] text-text font-medium border-b-2 border-brand-fg pb-1">
              Emails
            </span>
            <span className="text-[10px] text-text-subtle">Tasks</span>
          </div>
        )}

        {show(3) && (
          <div className="flex justify-end animate-fade-in">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors duration-300 ${
                show(4) ? 'bg-brand-fg text-text-inverse' : 'border border-border text-text-subtle'
              }`}
            >
              <Mail size={10} strokeWidth={1.5} />
              Send email
            </span>
          </div>
        )}

        {show(4) && !show(5) && (
          <div className="absolute right-0 top-16 z-10 w-32 rounded-lg border border-border bg-card shadow-sm py-1 animate-fade-in">
            <p className="px-2 py-0.5 text-[9px] text-text-subtle">Pick a template</p>
            <p className="px-2 py-1 text-[10px] text-text font-medium">Enquiry reply</p>
          </div>
        )}

        {show(5) && !show(7) && (
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5 animate-fade-in">
            <p className="text-[10px] font-medium text-text">Send email to Ellie &amp; Tom</p>
            <div className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-text">
              Thanks for getting in touch, Ellie &amp; Tom
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded bg-surface-muted" />
              <div className="h-1.5 w-4/5 rounded bg-surface-muted" />
            </div>
            <div className="flex justify-end">
              <span
                className={`rounded-lg px-2.5 py-0.5 text-[10px] transition-colors duration-300 ${
                  show(6) ? 'bg-brand-fg text-text-inverse' : 'bg-surface-muted text-text-subtle'
                }`}
              >
                Send
              </span>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="rounded-lg border border-border bg-card px-2.5 py-2 flex items-center justify-between animate-fade-in">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-text truncate">Enquiry reply</p>
              <p className="text-[9px] text-text-subtle truncate">to ellie@example.com</p>
            </div>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] text-text-muted">
              Sent
            </span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
