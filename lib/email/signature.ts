/**
 * Render an email signature (TipTap JSON) to sanitised HTML.
 *
 * The signature is a Gmail/Outlook-style block: rich formatting, colours,
 * font sizes, links, and images, but no template variables. It gets its
 * own, more permissive sanitiser than the email template body (it must
 * allow inline `style` and `img`), kept narrow with a property allowlist
 * so a hand-crafted signature can't smuggle in dangerous CSS or schemes.
 *
 * Used both by the live editor preview and by the `{{mc.signature}}`
 * injection in `lib/email/templates`, so the preview matches the send.
 *
 * @module lib/email/signature
 */
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import sanitizeHtml from 'sanitize-html'

import { SIGNATURE_EXTENSIONS } from './signature-extensions'

// Colour values accepted in inline styles: hex, rgb(a), or a bare CSS
// colour keyword. Anything else (e.g. `url(...)`, `expression(...)`) is
// dropped by the sanitiser.
const COLOUR = [/^#(?:[0-9a-f]{3,8})$/i, /^rgba?\([\d.,\s%]+\)$/i, /^[a-z]+$/i]

const SIGNATURE_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'div', 'span', 'br', 'a', 'img', 'mark',
    'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      color: COLOUR,
      'background-color': COLOUR,
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d+(?:\.\d+)?(px|em|rem|pt|%)$/],
      'font-family': [/^[\w\s,"'-]+$/],
      width: [/^\d+(?:\.\d+)?(px|%)$/],
      height: [/^\d+(?:\.\d+)?(px|%)$/],
    },
  },
  // Images come from our public storage bucket; links from the MC. No
  // data: URLs (keeps emails light and dodges base64 image stripping).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Force external links to open safely.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
}

/**
 * Whether a signature doc has nothing renderable: no non-whitespace text
 * and no image. An unset or empty-paragraph signature counts as empty, so
 * `{{mc.signature}}` collapses to nothing rather than an empty bubble.
 */
export function isSignatureEmpty(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true
  const hasContent = (node: JSONContent): boolean =>
    (node.type === 'text' && !!node.text?.trim()) ||
    node.type === 'image' ||
    (node.content ?? []).some(hasContent)
  return !hasContent(doc)
}

/**
 * Render a signature doc to sanitised HTML, or `''` when empty.
 */
export function renderSignatureHtml(doc: JSONContent | null | undefined): string {
  if (isSignatureEmpty(doc)) return ''
  const raw = generateHTML(doc as JSONContent, SIGNATURE_EXTENSIONS)
  return sanitizeHtml(raw, SIGNATURE_SANITIZE)
}
