/**
 * TipTap schema and server-safe render for couple scripts.
 *
 * Builds on the branding rich-text set (headings, lists, underline, colour,
 * font family, font size, highlight, alignment) minus its variable chips (a
 * script is written for one couple, not merged) and adds a page-break block,
 * since a performer decides where a page ends. The same list feeds the
 * client editor and `renderScriptHtml`, so stored JSON round-trips
 * identically. The sanitizer remains the allowlist boundary for generated
 * HTML.
 *
 * No React here.
 *
 * @module lib/documents/script-extensions
 */
import { Node, type AnyExtension, type JSONContent } from '@tiptap/core'
import { FontSize } from '@tiptap/extension-text-style'
import { generateHTML } from '@tiptap/html'

import { RICH_TEXT_EXTENSIONS } from '@/lib/branding/rich-text-extensions'
import { sanitizeRichHtml } from '@/lib/branding/rich-text-sanitize'

/** Font sizes (px) offered in the script toolbar. Larger than the branding ladder: scripts are read at a distance. */
export const SCRIPT_FONT_SIZES = [11, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 72] as const

/** An empty single-paragraph script. */
export const EMPTY_SCRIPT_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * Block-level atom marking a forced page break in print. Serialises to
 * `<hr data-page-break="">`; the print CSS turns that into `break-before:
 * page`. The client editor adds a NodeView with a visible label.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  // Above StarterKit's horizontalRule (100) so `<hr data-page-break>` parses
  // back as a page break rather than a plain rule.
  priority: 1000,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'hr[data-page-break]' }]
  },

  renderHTML() {
    return ['hr', { 'data-page-break': '' }]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).createParagraphNear().run(),
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a page break at the cursor and continue in a fresh paragraph. */
      setPageBreak: () => ReturnType
    }
  }
}

/**
 * The script schema. `FontSize` is re-declared last so the branding ladder is
 * replaced rather than duplicated; the variable node is dropped; everything
 * else is the branding set as is.
 */
export const SCRIPT_EXTENSIONS: AnyExtension[] = [
  ...RICH_TEXT_EXTENSIONS.filter((e) => e.name !== 'fontSize' && e.name !== 'variable'),
  FontSize,
  PageBreak,
]

/**
 * Render a script to safe HTML. Same pipeline as the branding surfaces:
 * controlled `generateHTML`, then the sanitizer. Malformed JSON renders as
 * empty rather than throwing, so a damaged row never breaks the tab.
 */
export function renderScriptHtml(content: JSONContent | null | undefined): string {
  if (!content) return ''
  try {
    return sanitizeRichHtml(generateHTML(content, SCRIPT_EXTENSIONS))
  } catch {
    return ''
  }
}

/** JSON with object keys sorted, so two documents compare by shape and not by key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * Whether two documents are the same script. Postgres `jsonb` returns a
 * stored document with its keys reordered, so a string comparison against
 * what the editor emitted is always false; this compares structure.
 */
export function scriptDocEquals(a: JSONContent | null | undefined, b: JSONContent | null | undefined): boolean {
  return stableStringify(a ?? null) === stableStringify(b ?? null)
}

/** Plain text of a script (chips dropped), for previews and search. */
export function scriptPlainText(content: JSONContent | null | undefined): string {
  if (!content) return ''
  const parts: string[] = []
  const walk = (node: JSONContent) => {
    if (node.type === 'text' && node.text) parts.push(node.text)
    for (const child of node.content ?? []) walk(child)
    if (node.type === 'paragraph' || node.type === 'heading') parts.push('\n')
  }
  walk(content)
  return parts.join('').replace(/\n{2,}/g, '\n').trim()
}
