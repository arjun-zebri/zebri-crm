'use client'

import { ChevronDown, FileText, Paperclip, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { Backdrop, EditorToolbar, InsertVariableChip, PreviewModal } from './preview-modal'
import { TypedRich, Typewriter } from './typewriter'
import { usePreviewScript, useSettledBeat } from './use-preview-script'

/**
 * Beats: 0 blank, 1 sidebar click reveals the page, 2 New template clicked
 * (the editor modal opens on the same beat, at its final size), 3 name
 * typed, 4 subject typed, 5 and 6 body typed, 7 Attach file clicked, 8 the
 * PDF lands.
 *
 * Subject and body write themselves in with the rich typewriter; every box
 * has a fixed height, so the modal never changes size while it fills.
 */
const BEATS = 9

// One typing rate for all three fields, so name, subject and body fill at
// the same visible speed instead of three. The ceiling is the body: 143
// steps have to land before its window closes or the rest snaps in mid
// sentence, which is why the body gets two beats rather than one. That
// 3200ms window is what buys a rate slow enough to read.
const TYPE_MS = 20

// The pointer clicks the two real buttons and the attachment control; the
// email itself writes in without the cursor jabbing around inside it.
const CURSOR: ({ target: string; click?: boolean } | null)[] = [
  null,
  { target: 'nav-templates', click: true },
  { target: 'new-template', click: true },
  { target: 'tpl-name' },
  null,
  null,
  null,
  { target: 'tpl-attach', click: true },
  null,
]

/** A raw template token with the editor's green highlight. */
function Tok({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className="rounded bg-green-50 px-1 py-px text-[10px] font-medium text-green-700">
      {children}
    </span>
  )
}

const SUBJECT_SEGMENTS = [
  { text: 'Thanks for reaching out, ' },
  { chip: <Tok>{'{{couple.primary_name}}'}</Tok> },
]

const BODY_SEGMENTS = [
  { text: 'Hi ' },
  { chip: <Tok testId="couple-name-chip">{'{{couple.primary_name}}'}</Tok> },
  {
    text: ',\nThank you so much for getting in touch about your wedding! I would love to hear more about your day and how I can help.\nWarm regards,\n',
  },
  { chip: <Tok>{'{{mc.contact_name}}'}</Tok> },
  { text: ' ' },
  { chip: <Tok>{'{{mc.business_name}}'}</Tok> },
]

/**
 * Preview for step 5: writing a reusable email template.
 *
 * The editor modal mirrors the real one — Template name + Category row,
 * Subject and Body with their green Insert-variable affordances, raw
 * `{{tokens}}` highlighted in the copy, and an Attachments section whose
 * Attach file control the cursor clicks to land the PDF.
 */
export function ScriptTemplate({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion, beatMs: 1600 })
  const view = useSettledBeat(beat)
  const show = (from: number) => view >= from
  const c = CURSOR[beat]
  const clicking = !!c?.click && view === beat

  const modal = show(2) && (
    <Backdrop>
      <PreviewModal
        title="New template"
        wide
        footer={
          <span className="rounded-md px-3 py-1 text-xs bg-brand-fg text-text-inverse">
            Save template
          </span>
        }
      >
        <div className="flex gap-2">
          <div className="flex-1 min-w-0" data-cursor="tpl-name">
            <p className="text-[10px] text-text-subtle font-medium mb-0.5">Template name</p>
            <div className="rounded-lg border border-border px-2 h-6 flex items-center text-[11px] font-medium text-text">
              {show(3) ? (
                <Typewriter text="Enquiry reply" typing={view === 3} charMs={TYPE_MS} />
              ) : (
                <span className="inline-block w-px h-3 bg-text-subtle animate-pulse" />
              )}
            </div>
          </div>
          <div className="w-24 shrink-0">
            <p className="text-[10px] text-text-subtle font-medium mb-0.5">Category</p>
            <div className="rounded-lg border border-border px-2 h-6 flex items-center justify-between gap-1 text-[10px] text-text">
              <span className="flex items-center gap-1 truncate">
                <span className="size-1.5 rounded-full bg-info shrink-0" />
                Enquiry
              </span>
              <ChevronDown size={10} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] text-text-subtle font-medium">Subject</p>
            <InsertVariableChip />
          </div>
          <div className="rounded-lg border border-border px-2 h-6 flex items-center text-[11px] text-text overflow-hidden">
            {show(4) && <TypedRich segments={SUBJECT_SEGMENTS} typing={view === 4} charMs={TYPE_MS} />}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-text-subtle font-medium mb-0.5">Body</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <EditorToolbar insertVariable />
            <div className="px-2 py-1.5 h-[112px] overflow-hidden text-[11px] text-text leading-relaxed">
              {show(5) && (
                <TypedRich
                  segments={BODY_SEGMENTS}
                  typing={view === 5 || view === 6}
                  charMs={TYPE_MS}
                  className="whitespace-pre-line"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] text-text-subtle font-medium">Attachments</p>
            <span
              data-cursor="tpl-attach"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-brand-fg text-text-inverse"
            >
              <Paperclip size={10} strokeWidth={1.5} /> Attach file
            </span>
          </div>
          <div className="h-[18px] flex items-center">
            {show(8) ? (
              <div className="flex items-center gap-1.5 text-[11px] text-text animate-fade-in">
                <FileText size={12} strokeWidth={1.5} className="text-text-subtle" />
                Wedding-packages.pdf
              </div>
            ) : (
              <p className="text-[10px] text-text-subtle">
                Files attached here are included every time this template is sent.
              </p>
            )}
          </div>
        </div>
      </PreviewModal>
    </Backdrop>
  )

  return (
    <PreviewFrame
      activeNav="templates"
      navClicked={show(1)}
      cursorTarget={c?.target ?? null}
      clicking={clicking}
      cursorRevision={beat * 100 + view}
      overlay={modal || undefined}
    >
      <div className="relative h-full flex flex-col gap-2">
        {show(1) && (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-border animate-fade-in">
              <span className="text-base font-semibold text-text">Templates</span>
              <span
                data-cursor="new-template"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs border border-brand-fg bg-brand-fg text-text-inverse"
              >
                <Plus size={12} strokeWidth={1.5} />
                <span className="hidden sm:inline">New template</span>
              </span>
            </div>
            <div className="flex gap-2 border-b border-border pb-1 animate-fade-in">
              <span className="text-xs font-medium text-text border-b-2 border-brand-fg pb-1">Emails</span>
              <span className="text-xs text-text-subtle">Packages</span>
              <span className="text-xs text-text-subtle">Invoices</span>
            </div>
          </>
        )}
      </div>
    </PreviewFrame>
  )
}
