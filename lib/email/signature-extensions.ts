/**
 * Shared TipTap extension set for the email signature.
 *
 * The Settings signature editor (client, `useEditor`) and the
 * server-side HTML renderer ({@link renderSignatureHtml}) both build from
 * this one list, so a signature's stored JSON round-trips identically:
 * what the MC formats is exactly what gets emailed. Keep this the single
 * source of truth; adding a mark here (e.g. a new style) means both the
 * editor and the email render pick it up for free.
 *
 * No React here, so it is safe to import from both the client editor and
 * the server render path. Imports are named because the v3 styling
 * packages dropped their default exports.
 *
 * @module lib/email/signature-extensions
 */
import type { AnyExtension } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

/**
 * Image node with a persisted `width` so a resized signature image keeps
 * its size when rendered into an email. Width renders as an inline style
 * (height stays auto to preserve aspect ratio). The editor extends this
 * further with a resize/delete NodeView; the server render uses it as-is.
 */
export const SignatureImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || element.getAttribute('width') || null,
        renderHTML: (attributes: { width?: string | null }) =>
          attributes.width ? { style: `width: ${attributes.width}` } : {},
      },
    }
  },
})

/**
 * The signature schema minus images: StarterKit (bold, italic, underline,
 * link, lists, headings) plus text styling (colour, font family, font
 * size), highlight, and alignment. TextStyle must precede the marks that
 * decorate it (Color / FontFamily / FontSize). Split out so the client
 * editor can add a React NodeView to the image while the server render
 * uses the plain {@link SignatureImage}.
 */
export const SIGNATURE_BASE_EXTENSIONS: AnyExtension[] = [
  StarterKit,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
]

/** Full signature schema for server-side rendering (plain image node). */
export const SIGNATURE_EXTENSIONS: AnyExtension[] = [
  ...SIGNATURE_BASE_EXTENSIONS,
  SignatureImage.configure({ inline: false }),
]
