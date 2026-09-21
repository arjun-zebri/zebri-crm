/**
 * A `textAlign` attribute on the `paragraph` and `heading` nodes: `'left'`,
 * `'center'` or `'right'`. A hand-rolled equivalent of
 * `@tiptap/extension-text-align`, not the stock package, for one
 * difference on the parse side: pasted HTML very commonly carries an
 * explicit `text-align: left` that is the source's default, not the
 * author's intent (Word, Google Docs, ...). The stock extension stores
 * that as a real `'left'`, which then permanently pins every pasted
 * paragraph left on both the editor canvas and the public page (a node's
 * own alignment always beats the section's and the theme role's), so
 * Global style's per-role Alignment silently stopped doing anything for
 * pasted text. Here a pasted `'left'` parses as `null` ("unset", so the
 * section/role decides) while `'center'`/`'right'` are kept.
 *
 * A stored `'left'` is therefore always a deliberate pick from the text
 * bar's Align pill (`text-bar-style.ts`'s `applyTextStyle`) and renders
 * as a real inline `text-align: left` exactly like `'center'`/`'right'`
 * - it has to, or "Align left" does nothing inside a centred section or
 * on a heading whose theme role is centred (live bug, 2026-09-20).
 * `render/rich-doc.tsx`'s `safeTextAlign` is the matching public-page
 * read side: any stored value renders, only an absent one defers.
 *
 * @module features/proposals/editor/extensions/text-align
 */
import { Extension } from '@tiptap/core'

/** The alignments this attribute recognises when parsing pasted HTML. */
export type TextAlignValue = 'left' | 'center' | 'right' | 'justify'

const ALIGN_VALUES: readonly string[] = ['left', 'center', 'right', 'justify']

/** Attributes this extension adds to `paragraph`/`heading`. */
interface TextAlignAttributes {
  textAlign?: TextAlignValue | null
}

/** Node types the `textAlign` attribute is registered on. */
interface TextAlignOptions {
  types: string[]
}

/** Adds a `textAlign` attribute to `paragraph`/`heading`, rendered as an inline `text-align` style; a pasted `'left'` parses as unset. See the module doc. */
export const TextAlignExtension = Extension.create<TextAlignOptions>({
  name: 'textAlign',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            // `'left'` from HTML is the source's default, not a choice; only
            // the Align pill writes a `'left'` worth keeping (module doc).
            parseHTML: (element: HTMLElement) => {
              const value = element.style.textAlign
              return ALIGN_VALUES.includes(value) && value !== 'left' ? (value as TextAlignValue) : null
            },
            renderHTML: (attributes: TextAlignAttributes) => {
              if (!attributes.textAlign) return {}
              return { style: `text-align: ${attributes.textAlign}` }
            },
          },
        },
      },
    ]
  },
})
