/**
 * The `textCase` mark (spec §2.2): a per-run case override. Renders as
 * `<span data-text-case>`; the CSS-native cases (`capitalize`, `uppercase`,
 * `lowercase`) get an inline `text-transform` from `lib/branding/text-case`,
 * matching the branding rich-text surfaces exactly. Sentence case has no CSS
 * equivalent, so the editor leaves the text untransformed and only carries
 * the `data-text-case="sentence"` marker; the renderer applies the actual
 * transform server-side via `applyCase` (a string rewrite, not CSS).
 *
 * @module features/proposals/editor/extensions/text-case
 */
import { Mark, mergeAttributes } from '@tiptap/core'

import { cssTextTransform } from '@/lib/branding/text-case'

/** The case values the `textCase` mark accepts (spec §2.2; narrower than `lib/branding/text-case`'s `TextCase`, which also allows `'none'`). */
export type TextCaseValue = 'sentence' | 'capitalize' | 'uppercase' | 'lowercase'

/** Attributes stored on a `textCase` mark. */
export interface TextCaseMarkAttrs {
  value: TextCaseValue
}

const DEFAULT_VALUE: TextCaseValue = 'sentence'

/** Inline case-transform mark (uppercase / lowercase / capitalize / sentence). */
export const TextCaseExtension = Mark.create({
  name: 'textCase',

  addAttributes() {
    return {
      value: {
        default: DEFAULT_VALUE,
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-text-case') as TextCaseValue | null) ?? DEFAULT_VALUE,
        renderHTML: (attrs: TextCaseMarkAttrs) => ({
          'data-text-case': attrs.value,
          style: `text-transform: ${cssTextTransform(attrs.value)}`,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-text-case]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes)]
  },
})
