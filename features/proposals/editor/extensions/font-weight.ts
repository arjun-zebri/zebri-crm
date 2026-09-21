/**
 * A `fontWeight` attribute on the shared `textStyle` mark (the Qwilr-parity
 * typography panel, `bars/text-bar-typography-panel.tsx`): a numeric CSS
 * weight override for the current selection, independent of the `bold`
 * mark - `bold` is semantic ("this run is emphasised", rendered
 * `<strong>`), `fontWeight` is a presentational choice (Light/Medium/
 * Semibold/...) that can sit on top of it, same as Qwilr's own panel
 * keeps both controls. Mirrors `@tiptap/extension-text-style`'s own
 * `FontSize`/`FontFamily` shape exactly; there is no official
 * `FontWeight` extension to import.
 *
 * No `addCommands` here, matching `text-case.ts`'s custom mark: every
 * write goes through `applyTextStyle`'s own `chain.setMark('textStyle',
 * ...)`/`chain.unsetMark(...)` calls, not a bespoke `setFontWeight`
 * command, so there is one write path for every `textStyle` attribute
 * instead of a mix of generic and attribute-specific commands.
 *
 * @module features/proposals/editor/extensions/font-weight
 */
import { Extension } from '@tiptap/core'

/** Attributes this extension adds to the `textStyle` mark. */
interface FontWeightAttributes {
  fontWeight?: string | null
}

/** Node/mark types the `fontWeight` attribute is registered on. */
interface FontWeightOptions {
  types: string[]
}

/** Adds a `fontWeight` attribute (e.g. `'300'`, `'700'`) to the `textStyle` mark, rendered as an inline `font-weight` style. */
export const FontWeightExtension = Extension.create<FontWeightOptions>({
  name: 'fontWeight',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontWeight || null,
            renderHTML: (attributes: FontWeightAttributes) => {
              if (!attributes.fontWeight) return {}
              return { style: `font-weight: ${attributes.fontWeight}` }
            },
          },
        },
      },
    ]
  },
})
