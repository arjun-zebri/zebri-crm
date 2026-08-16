/**
 * The "what does the couple receive?" panel, shared by every step
 * whose email is canned.
 *
 * Three modals showed the same subject row over the same sandboxed
 * frame with the same caption underneath; this is that, once.
 *
 * It also owns the loading state, which is the point. The MC's
 * branding arrives from a query, so a frame rendered before it lands
 * shows the unbranded shell and then swaps — the preview appearing to
 * change its mind about what the email looks like. Nothing is
 * rendered until the branding is in: a skeleton stands in, and the
 * first frame the MC sees is the real one.
 *
 * @module app/(dashboard)/automations/[id]/email-preview
 */
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** The frame's only document. Everything else is written into it. */
const BLANK = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>'

interface Props {
  /** The subject the sender builds. Skeleton until `ready`. */
  subject: ReactNode
  /** The email document. Not rendered until `ready`. */
  html: string
  /** Distinguishes this frame from any other on the page. */
  frameTitle: string
  /** One line under the frame, e.g. what the sample stands in for. */
  caption: ReactNode
  /**
   * False while anything the preview is built from is still loading.
   * A half-built preview is worse than none: it teaches the MC the
   * wrong thing about their own email.
   */
  ready: boolean
  /** Optional controls beside the "Preview" label, e.g. audience tabs. */
  actions?: ReactNode
  /** Frame height. Taller for a document with a header and a footer. */
  height?: string
}

export function EmailPreview({
  subject,
  html,
  frameTitle,
  caption,
  ready,
  actions,
  height = 'h-80',
}: Props) {
  // The frame's own document never changes: it loads `BLANK` once and
  // every version of the email is written into it. Binding `srcDoc` to
  // the html instead would reload the whole frame on each change,
  // which a preview that reacts to a field (the questionnaire's
  // title) would do on every keystroke.
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded) return
    // Reachable because the frame is `allow-same-origin`; a bare
    // `sandbox=""` is an opaque origin where this is null.
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    doc.documentElement.innerHTML = html
      .replace(/^[\s\S]*?<html>/, '')
      .replace(/<\/html>\s*$/, '')
  }, [loaded, html])

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-body font-medium text-text">Preview</p>
        {ready ? actions : null}
      </div>

      <div className="overflow-hidden rounded-control border border-border">
        <div className="border-b border-border bg-surface-muted px-4 py-3">
          <p className="text-body text-text-subtle">Subject</p>
          {ready ? (
            <p className="text-body font-medium text-text">{subject}</p>
          ) : (
            <div className="my-1 h-4 w-3/5 animate-pulse rounded-control bg-surface-emphasis" />
          )}
        </div>

        <div className={`relative ${height} w-full`}>
          {/* Mounted only once the branding is in, so the first email
              painted is the branded one. */}
          {ready && (
            <iframe
              ref={frameRef}
              // `allow-same-origin` and nothing else: scripts, forms
              // and popups stay blocked, but the parent can reach
              // `contentDocument` to patch the body.
              sandbox="allow-same-origin"
              srcDoc={BLANK}
              onLoad={() => setLoaded(true)}
              title={frameTitle}
              className="h-full w-full bg-white"
            />
          )}

          {/* Covers the frame until its document has been written,
              rather than showing an empty white box for a tick. */}
          {(!ready || !loaded) && (
            <div className="absolute inset-0 bg-surface p-6" aria-hidden>
              {/* The shape of the email underneath, so the panel does
                  not jump when the real one arrives. */}
              <div className="mx-auto max-w-md space-y-3">
                <div className="h-3 w-24 animate-pulse rounded-control bg-surface-muted" />
                <div className="h-6 w-3/4 animate-pulse rounded-control bg-surface-muted" />
                <div className="h-3 w-full animate-pulse rounded-control bg-surface-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded-control bg-surface-muted" />
                <div className="h-9 w-40 animate-pulse rounded-control bg-surface-muted" />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-body text-text-muted">{caption}</p>
    </div>
  )
}
