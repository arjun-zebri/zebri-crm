'use client'

import { ArrowLeft, Mail, Plus, Power, Search, UserPlus, type LucideIcon } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript, useSettledBeat } from './use-preview-script'

/**
 * Beats: 0 blank, 1 sidebar click reveals the canvas, 2 Add trigger clicked
 * (picker opens beside it), 3 New enquiry picked, 4 trigger card set,
 * 5 Add action clicked (picker opens beside it), 6 Send email picked,
 * 7 action card lands complete — template row included, no morphing —
 * 8 activated, 9 rest with the pointer away.
 */
const BEATS = 10

const CURSOR: ({ target: string; click?: boolean } | null)[] = [
  null,
  { target: 'nav-automations', click: true },
  { target: 'add-trigger', click: true },
  { target: 'pick-trigger', click: true },
  null,
  { target: 'add-action', click: true },
  { target: 'pick-action', click: true },
  null,
  { target: 'activate', click: true },
  null,
]

/**
 * Preview for step 7: the automation that sends the template on its own.
 *
 * Mirrors the real canvas builder — the Activate toggle lives in the header,
 * and both the trigger and the action are chosen by clicking their dashed
 * placeholder and picking from a dropdown anchored right next to it. The
 * action arrives with the step 5 template already applied.
 */
export function ScriptAutomation({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const view = useSettledBeat(beat)
  const show = (from: number) => view >= from
  const on = show(8)
  const c = CURSOR[beat]
  const clicking = !!c?.click && view === beat

  return (
    <PreviewFrame
      activeNav="automations"
      navClicked={show(1)}
      cursorTarget={c?.target ?? null}
      clicking={clicking}
      cursorRevision={beat * 100 + view}
    >
      <div className="relative h-full flex flex-col">
        {show(1) && (
          <div className="flex items-center gap-2 pb-2 border-b border-border animate-fade-in">
            <ArrowLeft size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            <span className="text-xs font-semibold text-text truncate">Enquiry auto-reply</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-pill font-medium ${
                on ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {on ? 'Active' : 'Paused'}
            </span>
            <span className="hidden sm:inline text-[10px] text-text-subtle ml-auto">Saved · just now</span>
            <button
              type="button"
              data-cursor="activate"
              className={`ml-auto sm:ml-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-control border transition-colors duration-300 ${
                on ? 'border-border text-text' : 'bg-brand-fg border-brand-fg text-text-inverse'
              }`}
            >
              <Power size={11} strokeWidth={1.5} />
              {on ? 'Pause' : 'Activate'}
            </button>
          </div>
        )}

        {show(1) && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 animate-fade-in">
            <NodeLabel>Trigger</NodeLabel>
            {/* Each slot is its own anchor: the picker opens right beside
                the placeholder it belongs to, like a real dropdown. */}
            <div className="relative">
              {show(4) ? (
                <NodeCard icon={UserPlus} title="New enquiry" subtitle="When a couple is added to your CRM" />
              ) : (
                <Placeholder target="add-trigger" icon={Plus} title="Add trigger" subtitle="Choose what starts this" />
              )}
              {(view === 2 || view === 3) && (
                <Picker
                  title="Find a trigger…"
                  group="Couples"
                  icon={UserPlus}
                  label="New enquiry"
                  desc="When a couple is added to your CRM"
                  target="pick-trigger"
                  className="top-full mt-1.5"
                />
              )}
            </div>

            <Connector shown={show(4)} />

            {show(4) && <NodeLabel>Action</NodeLabel>}
            {show(4) && (
              <div className="relative">
                {show(7) ? (
                  <div className="w-48 rounded-control border border-border bg-surface animate-fade-in">
                    <div className="px-3 py-2 flex items-start gap-2">
                      <Mail size={15} strokeWidth={1.5} className="text-text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text truncate">Send email</p>
                        <p className="text-[10px] text-text-muted truncate">Send an email to the couple</p>
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-text-subtle">Template</span>
                      <span className="text-[10px] font-medium text-text rounded-control bg-surface-muted px-1.5 py-0.5">
                        Enquiry reply
                      </span>
                    </div>
                  </div>
                ) : (
                  <Placeholder target="add-action" icon={Plus} title="Add action" />
                )}
                {(view === 5 || view === 6) && (
                  <Picker
                    title="Find an action…"
                    group="Email"
                    icon={Mail}
                    label="Send email"
                    desc="Send an email to the couple"
                    target="pick-action"
                    className="bottom-full mb-1.5"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}

function NodeLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] uppercase tracking-wide text-text-subtle text-center">{children}</p>
}

function Connector({ shown }: { shown: boolean }) {
  return <div className={`w-px bg-border transition-all duration-500 ${shown ? 'h-3' : 'h-0'}`} aria-hidden />
}

/** A set trigger/action node, mirroring the canvas node card. */
function NodeCard({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="w-48 rounded-control border border-border bg-surface px-3 py-2 flex items-start gap-2 animate-fade-in">
      <Icon size={15} strokeWidth={1.5} className="text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-text truncate">{title}</p>
        <p className="text-[10px] text-text-muted truncate">{subtitle}</p>
      </div>
    </div>
  )
}

/** The dashed "Add trigger / Add action" placeholder the cursor clicks. */
function Placeholder({
  target,
  icon: Icon,
  title,
  subtitle,
}: {
  target: string
  icon: LucideIcon
  title: string
  subtitle?: string
}) {
  return (
    <div
      data-cursor={target}
      className="w-48 rounded-control border border-dashed border-border bg-surface px-3 py-2.5 flex flex-col items-center gap-0.5 text-text-muted"
    >
      <div className="flex items-center gap-1.5">
        <Icon size={14} strokeWidth={1.5} />
        <span className="text-xs font-medium">{title}</span>
      </div>
      {subtitle && <span className="text-[10px] text-text-subtle">{subtitle}</span>}
    </div>
  )
}

/** A miniature command palette, anchored to the slot it opened from. */
function Picker({
  title,
  group,
  icon: Icon,
  label,
  desc,
  target,
  className,
}: {
  title: string
  group: string
  icon: LucideIcon
  label: string
  desc: string
  target: string
  className: string
}) {
  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-20 w-52 rounded-control border border-border bg-card shadow-xl overflow-hidden animate-fade-in ${className}`}
    >
      <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-2">
        <Search size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
        <span className="text-[11px] text-text-subtle">{title}</span>
      </div>
      <div className="py-1">
        <p className="px-2.5 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-text-subtle">{group}</p>
        <div data-cursor={target} className="px-2.5 py-1.5 flex items-center gap-2 bg-surface-muted">
          <Icon size={13} strokeWidth={1.5} className="text-text-muted shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-text truncate">{label}</p>
            <p className="text-[9px] text-text-subtle truncate">{desc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
