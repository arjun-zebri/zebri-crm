/**
 * A `lineHeight` attribute on the `paragraph` and `heading` nodes (the
 * Qwilr-parity typography panel, `bars/text-bar-typography-panel.tsx`): a
 * unitless CSS line-height override for the current block, e.g. `'1.4'`.
 * A node attribute, not a `textStyle` mark attribute like font
 * weight/letter spacing: line-height is a block-level property (it
 * describes the spacing of every line inside the paragraph/heading, not
 * one selected run within it), matching how `textAlign` already lives on
 * these same two node types in `rich-doc-spec.ts`.
 *
 * `@tiptap/extension-text-style` ships an official `LineHeight`, but its
 * bundled `setLineHeight`/`unsetLineHeight` commands are hardcoded to
 * `chain().setMark('textStyle', ...)` regardless of the `types` option -
 * configuring it with `types: ['paragraph', 'heading']` would register
 * the attribute on the right nodes while leaving its own commands
 * writing to the wrong place. This is a small hand-rolled equivalent
 * instead, with no `addCommands` (same as `font-weight.ts`/
 * `letter-spacing.ts`): every write goes through `applyTextStyle`'s own
 * `chain.updateAttributes('paragraph' | 'heading', ...)` calls.
 *
 * @module features/proposals/editor/extensions/line-height
 */
import { Extension } from '@tiptap/core'

/** Attributes this extension adds to `paragraph`/`heading`. */
interface LineHeightAttributes {
  lineHeight?: string | null
}

/** Node types the `lineHeight` attribute is registered on. */
interface LineHeightOptions {
  types: string[]
}

/** Adds a `lineHeight` attribute (e.g. `'1.4'`) to `paragraph`/`heading`, rendered as an inline `line-height` style. */
export const LineHeightExtension = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: LineHeightAttributes) => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
        },
      },
    ]
  },
})
