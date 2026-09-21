/**
 * A `letterSpacing` attribute on the shared `textStyle` mark (the
 * Qwilr-parity typography panel, `bars/text-bar-typography-panel.tsx`):
 * a per-selection tracking override, e.g. `'0.5px'`. Mirrors
 * `font-weight.ts` (and, in turn, `@tiptap/extension-text-style`'s own
 * `FontSize`) exactly - no official `LetterSpacing` extension exists to
 * import, and no `addCommands` here for the same reason `font-weight.ts`
 * has none: every write goes through `applyTextStyle`'s generic
 * `chain.setMark('textStyle', ...)`.
 *
 * @module features/proposals/editor/extensions/letter-spacing
 */
import { Extension } from '@tiptap/core'

/** Attributes this extension adds to the `textStyle` mark. */
interface LetterSpacingAttributes {
  letterSpacing?: string | null
}

/** Node/mark types the `letterSpacing` attribute is registered on. */
interface LetterSpacingOptions {
  types: string[]
}

/** Adds a `letterSpacing` attribute (e.g. `'0.5px'`) to the `textStyle` mark, rendered as an inline `letter-spacing` style. */
export const LetterSpacingExtension = Extension.create<LetterSpacingOptions>({
  name: 'letterSpacing',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.letterSpacing || null,
            renderHTML: (attributes: LetterSpacingAttributes) => {
              if (!attributes.letterSpacing) return {}
              return { style: `letter-spacing: ${attributes.letterSpacing}` }
            },
          },
        },
      },
    ]
  },
})
