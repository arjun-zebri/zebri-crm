/**
 * Live preview of an email template, filled against a context.
 *
 * Renders the subject + body through the shared renderer in
 * `lib/email/templates`. In `preview` mode unresolved variables are
 * highlighted in amber so the MC can see exactly what would (and
 * wouldn't) be filled. Reused by the library editor (sample context)
 * and the couple Send-email modal (real couple context).
 *
 * @module app/(dashboard)/templates/template-preview
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useMemo } from 'react'

import {
  renderEmailSubject,
  renderEmailTemplate,
  type RenderMode,
  type VariableOverrides,
} from '@/lib/email/templates'
import type { RunContext } from '@/types/automations'

interface TemplatePreviewProps {
  subject: string
  content: JSONContent
  ctx: RunContext
  mode?: RenderMode
  /** Temporary inline fills, applied during render (manual compose). */
  overrides?: VariableOverrides
}

export function TemplatePreview({ subject, content, ctx, mode = 'preview', overrides }: TemplatePreviewProps) {
  const subjectText = useMemo(
    () => renderEmailSubject(subject, ctx, mode, overrides),
    [subject, ctx, mode, overrides],
  )
  const bodyHtml = useMemo(
    () => renderEmailTemplate(content, ctx, mode, overrides).html,
    [content, ctx, mode, overrides],
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs text-text-subtle">Subject</p>
        <p className="text-sm font-medium text-text">
          {subjectText || <span className="text-text-subtle">No subject</span>}
        </p>
      </div>
      <div
        // `[&_p:empty]:min-h-[1.4em]` preserves the blank lines the MC
        // types — an empty <p> otherwise collapses to zero height, so
        // intentional spacing vanished from the preview. List utilities
        // restore bullet/number markers Tailwind's reset strips.
        className="email-preview px-4 py-4 text-sm leading-relaxed text-text [&_a]:text-brand [&_p]:my-2 [&_p:empty]:min-h-[1.4em] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
        // Body HTML is sanitised by renderEmailTemplate before it reaches here.
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  )
}
