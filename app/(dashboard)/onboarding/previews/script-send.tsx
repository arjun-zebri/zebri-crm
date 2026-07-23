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
      <div className="relative h-full flex flex-col">
        {show(2) && (
          <div className="animate-fade-in pb-2 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-text">Ellie &amp; Tom</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                New
              </span>
            </div>
          </div>
        )}

        {show(3) && (
          <div className="flex gap-1 border-b border-border py-2 animate-fade-in">
            <span
              className={`text-xs px-2 py-1 rounded transition-colors ${
                show(3) ? 'text-text-subtle' : ''
              }`}
            >
              Overview
            </span>
            <span
              className={`text-xs px-2 py-1 rounded transition-colors ${
                show(3) ? 'bg-surface-muted text-text font-medium' : 'text-text-subtle'
              }`}
            >
              Emails
            </span>
            <span className="text-xs px-2 py-1 rounded text-text-subtle">Tasks</span>
          </div>
        )}

        {show(3) && !show(5) && (
          <div className="flex justify-end pt-2 animate-fade-in">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors duration-300 cursor-pointer ${
                show(4) ? 'bg-brand-fg text-text-inverse' : 'border border-border text-text-subtle'
              }`}
            >
              <Mail size={12} strokeWidth={1.5} />
              <span className="hidden sm:inline">Send email</span>
            </span>
          </div>
        )}

        {show(4) && !show(5) && (
          <div className="absolute right-4 top-24 z-10 w-56 rounded-lg border border-border bg-card shadow-sm p-3 animate-fade-in">
            <p className="text-[10px] text-text-subtle mb-2">Pick a template to send this couple</p>
            <p className="text-xs text-text font-medium cursor-pointer hover:bg-surface-muted p-2 rounded">
              Enquiry reply
            </p>
          </div>
        )}

        {show(5) && !show(7) && (
          <div className="flex-1 flex flex-col gap-2 pt-2 animate-fade-in">
            {!show(7) && (
              <div className="text-[10px] text-text-subtle">No emails sent yet</div>
            )}

            <div className="rounded-lg border border-border bg-card p-3 space-y-2 mt-auto">
              <p className="text-xs font-medium text-text">Email Ellie &amp; Tom</p>
              <div>
                <p className="text-[10px] text-text-subtle mb-1">Subject</p>
                <input
                  type="text"
                  placeholder="Thanks for getting in touch"
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-surface text-text placeholder-text-subtle"
                  readOnly
                />
              </div>
              <div className="space-y-1 h-6 overflow-hidden">
                <div className="h-1.5 w-full rounded bg-surface-muted" />
                <div className="h-1.5 w-4/5 rounded bg-surface-muted" />
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-xs text-text-subtle cursor-pointer">Cancel</span>
                <span
                  className={`rounded-lg px-3 py-1 text-xs transition-colors duration-300 cursor-pointer ${
                    show(6) ? 'bg-brand-fg text-text-inverse' : 'bg-surface-muted text-text-subtle'
                  }`}
                >
                  Send email
                </span>
              </div>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <p className="text-xs font-semibold text-text">Enquiry reply</p>
              <p className="text-[10px] text-text-subtle">to ellie@example.com</p>
              <div className="flex justify-end pt-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-muted text-text-muted font-medium">
                  Sent
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
