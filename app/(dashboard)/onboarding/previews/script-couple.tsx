'use client'

import { ChevronDown, Mail, Plus } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { Backdrop, PreviewModal } from './preview-modal'
import { Typewriter } from './typewriter'
import { usePreviewScript, useSettledBeat } from './use-preview-script'

/**
 * Beats: 0 blank, 1 sidebar click reveals the page, 2 New-couple menu,
 * 3 Add manually clicked — the modal opens on the same beat, so the click
 * reacts instantly — 4 name typed, 5 primary contact typed, 6 date typed,
 * 7 Save pressed, 8 the couple lands on the board.
 *
 * Every value row is a fixed 24px tall, so the modal's size never changes
 * while the fields fill in.
 */
const BEATS = 9

// Which control the pointer sits on each beat, keyed to a `data-cursor`
// attribute below so it lands on the real element, not a guessed spot.
const CURSOR: ({ target: string; click?: boolean } | null)[] = [
  null,
  { target: 'nav-couples', click: true },
  { target: 'new-couple', click: true },
  { target: 'add-manually', click: true },
  { target: 'field-name' },
  { target: 'field-primary' },
  { target: 'field-date' },
  { target: 'save', click: true },
  null,
]

/**
 * Preview for step 4: adding a couple.
 *
 * The content area starts blank until the sidebar click lands, and the Add
 * Couple form opens as a modal dimming the whole miniature app — mirroring
 * the real couple modal's underline fields, required markers and black Save.
 * Each field types in turn, with exactly one caret alive at any moment.
 */
export function ScriptCouple({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion, beatMs: 1300 })
  const view = useSettledBeat(beat)
  const show = (from: number) => view >= from
  const c = CURSOR[beat]
  const clicking = !!c?.click && view === beat

  const modal = show(3) && !show(8) && (
    <Backdrop>
      <PreviewModal
        title="Add Couple"
        footer={
          <>
            <span className="text-xs px-3 py-1 rounded-md border border-transparent bg-surface-muted text-text">
              Cancel
            </span>
            <span
              data-cursor="save"
              className="rounded-md px-3 py-1 text-xs border border-brand-fg bg-brand-fg text-text-inverse"
            >
              Save
            </span>
          </>
        }
      >
        {/* Focus moves one field at a time; idle fields show no caret. */}
        <Field
          label="Name"
          required
          target="field-name"
          typing={view === 4}
          focused={view === 3}
          value={show(4) ? 'Ellie & Tom' : ''}
        />
        <Field
          label="Primary contact"
          required
          target="field-primary"
          typing={view === 5}
          value={show(5) ? 'Ellie Brooks' : ''}
        />
        <Field label="Wedding date" target="field-date" typing={view === 6} value={show(6) ? '14 Mar 2027' : ''} />
        <div>
          <p className="text-[10px] text-text-muted mb-1">Status</p>
          <div className="border-b border-border h-6 flex items-center justify-between">
            <span className="text-xs text-text">New</span>
            <ChevronDown size={12} strokeWidth={1.5} className="text-text-subtle" />
          </div>
        </div>
      </PreviewModal>
    </Backdrop>
  )

  return (
    <PreviewFrame
      activeNav="couples"
      navClicked={show(1)}
      cursorTarget={c?.target ?? null}
      clicking={clicking}
      cursorRevision={beat * 100 + view}
      overlay={modal || undefined}
    >
      <div className="relative h-full flex flex-col">
        {show(1) && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border animate-fade-in">
            <div>
              <span className="text-base font-semibold text-text">Couples</span>
              <span className="text-xs text-text-muted ml-2">{show(8) ? '1' : '0'} total</span>
            </div>
            <span
              data-cursor="new-couple"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs border border-brand-fg bg-brand-fg text-text-inverse"
            >
              <Plus size={12} strokeWidth={1.5} />
              <span className="hidden sm:inline">New couple</span>
            </span>
          </div>
        )}

        {show(2) && !show(4) && (
          <div className="absolute right-4 top-11 z-10 w-40 rounded-xl border border-border bg-card shadow-lg py-1 animate-fade-in">
            <p data-cursor="add-manually" className="px-3 py-1.5 text-xs text-text hover:bg-surface-muted">
              Add manually
            </p>
            <p className="px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted">
              Import from CSV
            </p>
          </div>
        )}

        {show(8) && (
          <div className="flex-1 flex gap-2 overflow-hidden">
            <BoardColumn tone="amber" label="New">
              <div className="rounded-xl border border-border bg-card p-3 space-y-2 animate-fade-in">
                <p className="text-xs font-semibold text-text">Ellie &amp; Tom</p>
                <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                  <Mail size={11} strokeWidth={1.5} />
                  <span>ellie@example.com</span>
                </div>
              </div>
            </BoardColumn>
            <BoardColumn tone="blue" label="Contacted" empty />
            <BoardColumn tone="purple" label="Confirmed" empty />
            <BoardColumn tone="green" label="Paid" empty />
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}

/**
 * An underline field mirroring the couple modal's inputs. The value row is
 * a fixed height in every state (empty, caret, typing, filled) so the
 * modal never resizes as the form fills.
 */
function Field({
  label,
  value,
  required,
  typing,
  focused,
  target,
}: {
  label: string
  value: string
  required?: boolean
  typing?: boolean
  /** Shows the idle caret — at most one field should be focused at a time. */
  focused?: boolean
  target?: string
}) {
  return (
    <div data-cursor={target}>
      <p className="text-[10px] text-text-muted mb-1">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>
      <div className="border-b border-border h-6 flex items-center text-xs text-text">
        {typing ? (
          <Typewriter text={value} typing />
        ) : value ? (
          <span>{value}</span>
        ) : focused ? (
          <span className="w-px h-3 bg-text-subtle animate-pulse" />
        ) : null}
      </div>
    </div>
  )
}

const TONE: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  green: 'bg-green-50 text-green-600',
}

/** A Kanban status column matching the couples board. */
function BoardColumn({
  tone,
  label,
  empty,
  children,
}: {
  tone: string
  label: string
  empty?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`min-w-[128px] shrink-0 ${empty ? 'opacity-30' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${TONE[tone]}`}>{label}</span>
      </div>
      {empty ? <div className="h-24 rounded-xl border border-dashed border-border" /> : children}
    </div>
  )
}
