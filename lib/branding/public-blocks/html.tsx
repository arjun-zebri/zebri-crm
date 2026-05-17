// Renders inline-edited rich text content (B/I/U + lists). Sanitizes
// the HTML allowlist before passing to dangerouslySetInnerHTML.
//
// Used everywhere the editor's InlineText writes a value that's later
// shown on a public surface (quote, invoice, contract, footer, etc.).

import { sanitizeHtml } from '../sanitize'

interface HtmlProps {
  value: string | null | undefined
  /** Default true. Pass false for single-line surfaces where lists shouldn't appear. */
  allowLists?: boolean
  className?: string
  style?: React.CSSProperties
  /** Tag name. Defaults to span. */
  as?: 'span' | 'div' | 'p'
}

export function Html({ value, allowLists = true, className, style, as = 'span' }: HtmlProps) {
  const html = sanitizeHtml(value ?? '', { allowLists })
  if (!html) return null
  const Tag = as as 'span'
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
}
