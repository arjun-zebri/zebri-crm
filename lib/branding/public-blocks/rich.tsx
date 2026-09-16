'use client'

import type { CSSProperties } from 'react'

// eslint-disable-next-line no-restricted-imports -- type-only; the value shape lives with the editor
import type { RichTextValue } from '@/app/(dashboard)/branding/blocks/types'

import { renderRichText, renderRichTextInline } from '../render-rich-text'

/**
 * Public renderer for a rich-text field value. `inline` unwraps the paragraph
 * so it can sit inside a heading or a phrasing context (a section heading, a
 * caption); the default keeps block-level paragraphs (an FAQ answer, body
 * copy). Legacy plain-string values still render, since `renderRichText`
 * treats a string as escaped text.
 */
export function Rich({
  value,
  values,
  inline = false,
  className,
  style,
}: {
  value: RichTextValue | null | undefined
  values?: Record<string, string> | undefined
  inline?: boolean | undefined
  className?: string | undefined
  style?: CSSProperties | undefined
}) {
  const html = inline ? renderRichTextInline(value, values ?? {}) : renderRichText(value, values ?? {})
  // Inline sits in a phrasing context (a heading, a caption) as a <span>;
  // block output carries <p> paragraphs, which a <span> cannot hold, so it
  // renders in a <div>.
  return inline ? (
    <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
