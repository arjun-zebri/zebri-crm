/**
 * Read-only preview of a contract template's body.
 *
 * Renders the stored rich-text (TipTap JSON) as a calm document, with any
 * merge variables shown as labelled chips via the shared
 * {@link renderTemplateChips} (a generic TipTap → sanitised-HTML renderer).
 * Read-only — editing happens in the contract editor modal.
 *
 * @module app/(dashboard)/templates/contract-template-preview
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useMemo } from 'react'

import { renderTemplateChips } from '@/lib/email/templates'

export function ContractTemplatePreview({ content }: { content: JSONContent }) {
  const html = useMemo(() => renderTemplateChips(content), [content])

  return (
    <div
      // Sanitised by renderTemplateChips. Heading/list utilities give the
      // document calm structure without an editor chrome.
      className="rounded-control border border-border bg-card px-5 py-5 text-sm leading-relaxed text-text [&_a]:text-brand [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_p:empty]:min-h-[1.4em] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
