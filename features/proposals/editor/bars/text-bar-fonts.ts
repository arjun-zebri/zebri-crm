/**
 * The text bar's Font select round-trips between a `FontId` (what the
 * user picks and the branding catalogue knows) and a CSS font-stack
 * string (what the `textStyle` mark's `fontFamily` attribute actually
 * stores, since `render/rich-doc.tsx` assigns it to CSS `fontFamily`
 * verbatim with no lookup: see that file's `if (typeof a.fontFamily
 * === 'string') style.fontFamily = a.fontFamily`). Split out of
 * `text-bar-style.ts` to keep that file near the ~150-line guideline.
 * The stack-to-id lookup itself lives in `lib/branding/fonts` (the public
 * proposal page needs it too) and is re-exported here for the bar.
 *
 * @module features/proposals/editor/bars/text-bar-fonts
 */
import { FONT_IDS, FONT_STACKS, type FontId } from '@/lib/branding/fonts'

export { fontIdFromStack } from '@/lib/branding/fonts'

/**
 * The Font select's "no override" option value. Not `''`: the shared
 * `Select` primitive crashes on an empty-string option value, so every
 * "clear" choice in this bar uses a non-empty sentinel instead (see
 * the "Select empty-value constraint" gotcha this codebase has hit
 * more than once).
 */
export const FONT_NONE = '__font_none__'

/** Every `FontId` mapped to its CSS font-stack, for the Font select's options. Built once; the catalogue never changes at runtime. */
export const FONT_OPTIONS: ReadonlyArray<{ value: FontId; stack: string }> = FONT_IDS.map((id) => ({ value: id, stack: FONT_STACKS[id] }))
