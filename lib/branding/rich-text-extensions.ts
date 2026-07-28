/**
 * Shared TipTap extension set for the branding editor's rich-text fields.
 *
 * Mirrors the email signature pattern: the client editor and the server-side
 * renderer build from this one list so stored JSON round-trips identically. No
 * React here, so both the client editor and the server render path can import
 * it. The client editor layers a React NodeView onto {@link Variable} for the
 * mint chip; the server render uses the plain node (an empty
 * `<span data-variable="id">`), which {@link resolveVariablesInHtml} substitutes.
 *
 * Security: the extension set is the allowlist of what marks/attributes can ever
 * appear in generated HTML. Value validation (colours, font sizes/families)
 * happens in `rich-text-sanitize.ts` as defence in depth, since the stored JSON
 * is user-writable (`branding_blocks` jsonb under RLS).
 *
 * @module lib/branding/rich-text-extensions
 */
import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

/** Font sizes (px) offered in the toolbar and accepted by the sanitizer. */
export const RICH_TEXT_FONT_SIZES = [11, 13, 14, 16, 20, 24, 32, 48] as const

/**
 * Inline atom node for a document variable (e.g. `{{ couple_name }}`).
 *
 * Serializes to a self-contained, empty `<span data-variable="id">`. The server
 * render leaves it for `resolveVariablesInHtml` to replace with the real value;
 * the client editor renders it as a mint chip via a React NodeView it adds on
 * top (see `RichText`).
 */
export const Variable = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-variable'),
        renderHTML: (attrs: { id?: string | null }) =>
          attrs.id ? { 'data-variable': attrs.id } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes)]
  },
})

/**
 * The branding rich-text schema: StarterKit (bold, italic, lists, headings),
 * underline, text styling (colour, font family, font size), highlight,
 * alignment, and the variable node. `TextStyle` must precede the marks that
 * decorate it. This is the server-safe set used by `generateHTML`; the client
 * editor extends `Variable` with a NodeView.
 */
export const RICH_TEXT_EXTENSIONS: AnyExtension[] = [
  StarterKit,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Variable,
]
