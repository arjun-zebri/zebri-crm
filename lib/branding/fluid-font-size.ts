/**
 * TipTap's `FontSize` (the `fontSize` attribute on the shared `textStyle`
 * mark, plus its `setFontSize`/`unsetFontSize` commands) with the one
 * change every document surface needs: the size is *rendered* through
 * `fluidFontSize` (`./fluid-type.ts`), exactly as the proposal renderer
 * (`features/proposals/render/rich-doc.tsx`) renders the same mark, so a
 * 46px title shrinks on a phone (and on the editor's mobile canvas) the
 * way body copy never does, instead of overflowing a 390px column. Used
 * by the proposal editors (content sections and data-section inline
 * fields); `RICH_TEXT_EXTENSIONS` deliberately keeps the stock `FontSize`
 * for `generateHTML`, and `render-rich-text.ts` applies the same rule to
 * the sanitised string instead (see its `fluidFontSizes` for why).
 *
 * The stored attribute stays the plain `'46px'` the size stepper reads
 * and writes, and that px value also goes out as `data-font-size` so
 * ProseMirror's clipboard, which round-trips a copy through this very
 * HTML, parses the px back rather than the `clamp()` string (which the
 * proposal layout schema's 8-character cap would reject on save). Pasted
 * outside HTML still contributes a plain px `font-size`; any other unit
 * or expression is dropped rather than stored.
 *
 * @module lib/branding/fluid-font-size
 */
import { FontSize } from '@tiptap/extension-text-style'

import { fluidFontSize } from './fluid-type'

const PX = /^\d+(?:\.\d+)?px$/

/** Attributes this extension contributes to the `textStyle` mark. */
interface FontSizeAttributes {
  fontSize?: string | null
}

/** `FontSize` with fluid rendering and a px-preserving parse. See the module doc. */
export const FluidFontSizeExtension = FontSize.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const stored = element.getAttribute('data-font-size')
              if (stored && PX.test(stored)) return stored
              const inline = element.style.fontSize.trim()
              return PX.test(inline) ? inline : null
            },
            renderHTML: (attributes: FontSizeAttributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${fluidFontSize(attributes.fontSize)}`, 'data-font-size': attributes.fontSize }
            },
          },
        },
      },
    ]
  },
})
