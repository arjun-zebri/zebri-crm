'use client'

import {
  AtSign,
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Undo2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * The dimmed sheet a preview modal sits on, scoped to the frame.
 *
 * Every in-preview modal (Add Couple, New template, the compose window)
 * renders over this, because in the real app those are modals over a
 * darkened page — a full-width inline panel reads as a different screen.
 */
export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-2 animate-fade-in">
      {children}
    </div>
  )
}

/** Props for {@link PreviewModal}. */
export interface PreviewModalProps {
  title: string
  /** Optional pill rendered beside the title (e.g. the Sent badge). */
  badge?: ReactNode
  /** Optional footer band — mirrors the real Modal's muted button row. */
  footer?: ReactNode
  /** Wider variant for the denser template editor. */
  wide?: boolean
  children: ReactNode
}

/**
 * A compact stand-in for the real `Modal`: bordered card, titled header
 * with a close glyph, body, and an optional muted footer band.
 */
export function PreviewModal({ title, badge, footer, wide, children }: PreviewModalProps) {
  return (
    <div
      className={`w-full ${wide ? 'max-w-[440px]' : 'max-w-[400px]'} rounded-control border border-border bg-card shadow-xl overflow-hidden animate-modal-in`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <p className="text-caption font-semibold text-text">{title}</p>
        {badge}
        <X size={13} strokeWidth={1.5} className="ml-auto text-text-subtle" />
      </div>
      <div className="p-3 space-y-2">{children}</div>
      {footer && (
        <div className="border-t border-border bg-surface-muted px-3 py-2 flex items-center justify-end gap-2">
          {footer}
        </div>
      )}
    </div>
  )
}

/**
 * The rich-text editor's toolbar row, miniaturised: headings, bold/italic,
 * lists, link, undo/redo — and the green "Insert variable" chip the real
 * template editor carries on the right.
 */
export function EditorToolbar({ insertVariable }: { insertVariable?: boolean }) {
  const icons = [Heading1, Heading2, Bold, Italic, List, ListOrdered, Link2, Undo2, Redo2]
  return (
    <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 text-text-subtle">
      {icons.map((Icon, i) => (
        <Icon key={i} size={11} strokeWidth={1.5} />
      ))}
      {insertVariable && <InsertVariableChip className="ml-auto" />}
    </div>
  )
}

/** The green "@ Insert variable" affordance from the real editor. */
export function InsertVariableChip({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-control bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-700 ${className ?? ''}`}
    >
      <AtSign size={9} strokeWidth={1.5} /> Insert variable
    </span>
  )
}
