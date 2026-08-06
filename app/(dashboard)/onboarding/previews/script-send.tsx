'use client'

import {
  Check,
  CheckSquare,
  Clock,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Mail,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { Backdrop, EditorToolbar, PreviewModal } from './preview-modal'
import { usePreviewScript, useSettledBeat } from './use-preview-script'

/**
 * Beats: 0 the couple profile is already open (Overview), 1 Emails tab
 * clicked, 2 Send email clicked — the template picker opens on the same
 * beat, 3 pointer reaches Enquiry reply, 4 it is picked and the compose
 * modal opens immediately, 5 pointer reaches Send, 6 Send pressed and the
 * button flips to a green Sent just after, 7 the animation rests there —
 * the composed email is the closing frame.
 */
const BEATS = 8

const CURSOR: ({ target: string; click?: boolean } | null)[] = [
  null,
  { target: 'pnav-emails', click: true },
  { target: 'send-email', click: true },
  { target: 'pick-template' },
  { target: 'pick-template', click: true },
  { target: 'send' },
  { target: 'send', click: true },
  null,
]

// The real profile's tab set (couple-profile.tsx navItems), trimmed to the
// rows that fit the miniature. Emails is the one this preview clicks.
const PROFILE_NAV: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { key: 'contacts', label: 'Contacts', Icon: Users },
  { key: 'timeline', label: 'Timeline', Icon: Clock },
  { key: 'automations', label: 'Automations', Icon: Sparkles },
  { key: 'emails', label: 'Emails', Icon: Mail },
]

/**
 * Preview for step 6: sending the template to the couple.
 *
 * Mirrors the real flow — the profile overlay's Emails tab, the template
 * picker under the Send email button, then the "Email Ellie & Tom" compose
 * modal with the subject and body resolved to plain text, addressed to
 * Ellie by first name. The animation ends here, on the sent email.
 */
export function ScriptSend({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const view = useSettledBeat(beat)
  const show = (from: number) => view >= from
  const c = CURSOR[beat]
  const clicking = !!c?.click && view === beat
  const emailsTab = show(1)

  // Send goes green shortly after the press instead of waiting out the rest
  // of the beat — a full beat of a pressed-but-unchanged button reads as a
  // hang. This clock starts when the click lands (view 6) and trails it by
  // just enough to look like the send went through. `show(7)` still covers
  // the resting and reduced-motion frames, where green is immediate.
  const sendLanded = useSettledBeat(view >= 6 ? 7 : 0, 300)
  const sent = show(7) || sendLanded >= 7

  const overlay = (
    <>
      <Backdrop>
        {/* The couple profile overlay, scaled down: header, vertical tab
            nav on the left, tab body on the right. */}
        <div className="w-[96%] h-[94%] rounded-control border border-border bg-card shadow-xl overflow-hidden flex flex-col animate-modal-in">
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
            <span className="text-body font-semibold text-text">Ellie &amp; Tom</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-amber-50 text-amber-600 font-medium">New</span>
            <X size={13} strokeWidth={1.5} className="ml-auto text-text-subtle" />
          </div>
          <div className="flex flex-1 min-h-0">
            <nav className="w-24 sm:w-28 shrink-0 border-r border-border px-1.5 py-2 space-y-0.5">
              {PROFILE_NAV.map(({ key, label, Icon }) => {
                const on = key === (emailsTab ? 'emails' : 'overview')
                return (
                  <span
                    key={key}
                    data-cursor={key === 'emails' ? 'pnav-emails' : undefined}
                    className={`flex items-center gap-1.5 rounded-control px-1.5 py-1 text-[10px] transition-colors duration-300 ${
                      on ? 'bg-surface-muted text-text font-medium' : 'text-text-subtle'
                    }`}
                  >
                    <Icon size={12} strokeWidth={1.5} className="shrink-0" />
                    <span className="hidden sm:inline truncate">{label}</span>
                  </span>
                )
              })}
            </nav>

            <div className="flex-1 min-w-0 p-2.5 relative flex flex-col">
              {!emailsTab ? (
                <div className="space-y-2 pt-1" aria-hidden>
                  <p className="text-caption font-semibold text-text">Overview</p>
                  <div className="h-1.5 w-1/2 rounded-control bg-surface-muted" />
                  <div className="h-1.5 w-2/3 rounded-control bg-surface-muted" />
                  <div className="h-1.5 w-1/3 rounded-control bg-surface-muted" />
                </div>
              ) : (
                <div className="animate-fade-in flex flex-col flex-1 min-h-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-caption font-semibold text-text">Emails</p>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] border border-border text-text">
                        <FlaskConical size={10} strokeWidth={1.5} /> Test
                      </span>
                      <span
                        data-cursor="send-email"
                        className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] border border-brand-fg bg-brand-fg text-text-inverse"
                      >
                        <Mail size={10} strokeWidth={1.5} /> Send email
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[10px] text-text-subtle text-center">
                      No emails sent yet
                      <br />
                      <span className="text-[9px]">Send this couple a template above.</span>
                    </p>
                  </div>

                  {/* Template picker — opens the moment Send email is
                      clicked, anchored right under the button. */}
                  {show(2) && !show(4) && (
                    <div className="absolute right-1 top-8 z-10 w-44 rounded-control border border-border bg-card shadow-lg py-1 animate-fade-in">
                      <p className="px-2.5 py-1 text-[9px] text-text-subtle">Pick a template to send this couple</p>
                      <p
                        data-cursor="pick-template"
                        className={`mx-1 px-1.5 py-1.5 rounded-control text-[11px] text-text transition-colors duration-300 ${
                          show(3) ? 'bg-surface-muted font-medium' : ''
                        }`}
                      >
                        Enquiry reply
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Backdrop>

      {/* The compose modal — the closing frame of this preview. Subject and
          body are resolved to plain text, addressed to Ellie by first name. */}
      {show(4) && (
        <Backdrop>
          <PreviewModal
            title="Email Ellie & Tom"
            footer={
              <>
                <span className="text-caption px-3 py-1 rounded-control text-text-muted">Cancel</span>
                {/* Black from the moment it appears — never greyed. The only
                    change is the flip to a green Sent once the send lands. */}
                <span
                  data-cursor="send"
                  className={`inline-flex items-center justify-center gap-1 rounded-control px-3 py-1 text-caption border min-w-[92px] transition-colors duration-300 ${
                    sent
                      ? 'bg-success border-transparent text-text-inverse'
                      : 'bg-brand-fg border-brand-fg text-text-inverse'
                  }`}
                >
                  {sent ? (
                    <>
                      <Check size={11} strokeWidth={2} /> Sent
                    </>
                  ) : (
                    <>
                      <Mail size={11} strokeWidth={1.5} /> Send email
                    </>
                  )}
                </span>
              </>
            }
          >
            <Boxed label="Subject">Thanks for reaching out, Ellie</Boxed>
            <div>
              <p className="text-[10px] text-text-subtle font-medium mb-1">Email</p>
              <div className="rounded-control border border-border overflow-hidden">
                <EditorToolbar />
                <div className="px-2.5 py-2 space-y-1.5 text-[11px] text-text leading-relaxed">
                  <p>Hi Ellie,</p>
                  <p>
                    Thank you so much for getting in touch about your wedding! I would love to hear more about your
                    day and how I can help.
                  </p>
                  <p>Warm regards,</p>
                  <p>Jordan · Jordan Weddings Co</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text">
              <span className="h-3 w-3 rounded-control border border-border bg-brand-fg flex items-center justify-center">
                <Check size={9} strokeWidth={2.5} className="text-text-inverse" />
              </span>
              <FileText size={12} strokeWidth={1.5} className="text-text-subtle" />
              Wedding-packages.pdf
            </div>
          </PreviewModal>
        </Backdrop>
      )}
    </>
  )

  return (
    <PreviewFrame
      activeNav="couples"
      navClicked
      cursorTarget={c?.target ?? null}
      clicking={clicking}
      cursorRevision={beat * 100 + view}
      overlay={overlay}
    >
      {/* The dashboard behind the profile overlay — barely visible, like
          the real app behind the real profile. */}
      <div className="h-full" />
    </PreviewFrame>
  )
}

/** A labelled, bordered value box mirroring the compose form's inputs. */
function Boxed({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-text-subtle font-medium mb-1">{label}</p>
      <div className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-[11px] text-text">{children}</div>
    </div>
  )
}
