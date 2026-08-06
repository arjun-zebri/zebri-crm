/**
 * Read-only "shape" preview of an email template for the preview pane.
 *
 * Unlike the editor's live preview (which fills sample values), this shows
 * the template's structure: every variable renders as a labelled blue chip
 * ("Couple names", "Event date"). The body goes through
 * {@link renderTemplateChips}; the subject is chipped here token by token.
 *
 * @module app/(dashboard)/templates/email-template-preview
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useMemo, type ReactNode } from 'react'

import { variableLabel } from '@/lib/automations/variables'
import { renderTemplateChips } from '@/lib/email/templates'

/** Matches `{{ namespace.key | filter }}` tokens in a subject string. */
const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g

function VarChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-control bg-blue-50 px-1.5 py-0.5 text-sm font-medium text-blue-700">
      {children}
    </span>
  )
}

/** Renders a subject line with `{{variable}}` tokens shown as chips. */
function SubjectChips({ subject }: { subject: string }) {
  if (!subject.trim()) return <span className="text-text-subtle">No subject</span>

  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of subject.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > last) nodes.push(subject.slice(last, idx))
    nodes.push(<VarChip key={i++}>{variableLabel(m[1] ?? '')}</VarChip>)
    last = idx + m[0].length
  }
  if (last < subject.length) nodes.push(subject.slice(last))
  return <>{nodes}</>
}

interface EmailTemplatePreviewProps {
  subject: string
  content: JSONContent
}

export function EmailTemplatePreview({ subject, content }: EmailTemplatePreviewProps) {
  const bodyHtml = useMemo(() => renderTemplateChips(content), [content])

  return (
    <div className="overflow-hidden rounded-control border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs text-text-subtle">Subject</p>
        <p className="text-sm font-medium text-text">
          <SubjectChips subject={subject} />
        </p>
      </div>
      <div
        // Sanitised by renderTemplateChips. List/empty-paragraph utilities
        // mirror the editor's live preview so spacing + bullets survive.
        className="email-preview px-4 py-4 text-sm leading-relaxed text-text [&_a]:text-brand [&_p]:my-2 [&_p:empty]:min-h-[1.4em] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  )
}
