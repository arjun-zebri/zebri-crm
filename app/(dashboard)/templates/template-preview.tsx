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
import { useEffect, useMemo, useRef, useState } from 'react'

import { wrapTemplateHtml } from '@/lib/email/html'
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
  /**
   * Render the finished email — the body wrapped in the branded shell
   * (logo, fonts, brand colours, footer) inside a sandboxed iframe — so
   * the preview is exactly what lands in the inbox. Off by default for
   * the compact body-only previews.
   */
  shell?: boolean
  /**
   * Shell viewport: `mobile` renders the iframe at phone width (375px,
   * centred) so the MC sees how the email reflows on a phone. Only
   * meaningful with `shell`.
   */
  device?: 'desktop' | 'mobile'
}

export function TemplatePreview({ subject, content, ctx, mode = 'preview', overrides, shell = false, device = 'desktop' }: TemplatePreviewProps) {
  const subjectText = useMemo(
    () => renderEmailSubject(subject, ctx, mode, overrides),
    [subject, ctx, mode, overrides],
  )
  const bodyHtml = useMemo(
    () => renderEmailTemplate(content, ctx, mode, overrides).html,
    [content, ctx, mode, overrides],
  )
  // The shell document, built by the same function the send route uses —
  // the WYSIWYG guarantee lives in that shared call. Built with a
  // placeholder body and filled imperatively below: swapping `srcDoc`
  // per keystroke reloads the whole iframe document, which made the
  // preview flash while typing. The shell only changes with branding.
  const shellDoc = useMemo(
    () => (shell ? wrapTemplateHtml('', ctx.mc.businessName, ctx.mc.branding) : null),
    [shell, ctx],
  )
  const frameRef = useRef<HTMLIFrameElement>(null)
  // The iframe document loads ONCE (srcDoc never changes). Every later
  // change — body edits and shell/appearance changes alike — patches the
  // live document in place, because swapping srcDoc reloads the whole
  // iframe and that reload reads as a flash.
  const [initialShellDoc] = useState(shellDoc)
  const appliedShellRef = useRef(shellDoc)
  const [frameLoads, setFrameLoads] = useState(0)
  useEffect(() => {
    if (!shell || frameLoads === 0 || shellDoc === null) return
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    if (appliedShellRef.current !== shellDoc) {
      // Shell changed (appearance toggle / branding): swap the markup
      // inside the same document — a synchronous DOM update, no reload.
      doc.documentElement.innerHTML = shellDoc
        .replace(/^[\s\S]*?<html>/, '')
        .replace(/<\/html>\s*$/, '')
      appliedShellRef.current = shellDoc
    }
    // `.zb-body` is the shell's body cell (see wrapTemplateHtml).
    const slot = doc.querySelector('.zb-body')
    if (slot) slot.innerHTML = bodyHtml
  }, [shell, frameLoads, shellDoc, bodyHtml])

  const subjectRow = (
    <div className="border-b border-border px-4 py-3">
      <p className="text-caption text-text-subtle">Subject</p>
      <p className="text-body font-medium text-text">
        {subjectText || <span className="text-text-subtle">No subject</span>}
      </p>
    </div>
  )

  if (shellDoc !== null) {
    return (
      // Fills its parent so only the iframe scrolls — a fixed iframe
      // height taller than the pane stacked two scrollbars.
      <div className="flex h-full flex-col overflow-hidden rounded-control border border-border bg-card">
        <div className="shrink-0">{subjectRow}</div>
        {/* allow-same-origin (still no allow-scripts, so the content is
            inert) lets the effect above write the body without reloading
            the document; images + the Google Fonts stylesheet load fine.
            Mobile: a centred 375px frame on a muted backdrop so the
            phone-width reflow reads as intentional. */}
        <div className={`min-h-0 flex-1 ${device === 'mobile' ? 'bg-surface-muted' : ''}`}>
          <iframe
            ref={frameRef}
            title="Email preview"
            sandbox="allow-same-origin"
            srcDoc={initialShellDoc ?? undefined}
            onLoad={() => setFrameLoads((n) => n + 1)}
            className={
              device === 'mobile' ? 'mx-auto block h-full w-[375px] max-w-full' : 'h-full w-full'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-control border border-border bg-card">
      {subjectRow}
      <div
        // `[&_p:empty]:min-h-[1.4em]` preserves the blank lines the MC
        // types — an empty <p> otherwise collapses to zero height, so
        // intentional spacing vanished from the preview. List utilities
        // restore bullet/number markers Tailwind's reset strips.
        className="email-preview px-4 py-4 text-body leading-relaxed text-text [&_a]:text-brand [&_p]:my-2 [&_p:empty]:min-h-[1.4em] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
        // Body HTML is sanitised by renderEmailTemplate before it reaches here.
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  )
}
