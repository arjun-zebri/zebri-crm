/**
 * A `topSpacing` attribute on the `paragraph` and `heading` nodes (the
 * Qwilr-parity typography panel, `bars/text-bar-typography-panel.tsx`):
 * extra space above the current block, in `em`, e.g. `'0.5em'`. A node
 * attribute, same reasoning as `line-height.ts`'s (block-level, not a
 * per-run `textStyle` property) - `em` rather than a bare number or `px`
 * so the gap scales with that block's own font size, matching how the
 * rest of the doc's spacing (padding presets, `SECTION_PADDING_PX`)
 * already tracks the type scale rather than a fixed pixel grid.
 *
 * No `addCommands`, matching every other new attribute extension here:
 * `applyTextStyle` writes it directly via
 * `chain.updateAttributes('paragraph' | 'heading', ...)`.
 *
 * @module features/proposals/editor/extensions/top-spacing
 */
import { Extension } from '@tiptap/core'

/** Attributes this extension adds to `paragraph`/`heading`. */
interface TopSpacingAttributes {
  topSpacing?: string | null
}

/** Node types the `topSpacing` attribute is registered on. */
interface TopSpacingOptions {
  types: string[]
}

/** Adds a `topSpacing` attribute (e.g. `'0.5em'`) to `paragraph`/`heading`, rendered as an inline `margin-top` style. */
export const TopSpacingExtension = Extension.create<TopSpacingOptions>({
  name: 'topSpacing',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          topSpacing: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginTop || null,
            renderHTML: (attributes: TopSpacingAttributes) => {
              if (!attributes.topSpacing) return {}
              return { style: `margin-top: ${attributes.topSpacing}` }
            },
          },
        },
      },
    ]
  },
})
