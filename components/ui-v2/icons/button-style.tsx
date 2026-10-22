import { createIcon } from './icon-base';

/**
 * Button-style glyphs for the brand kit's Buttons choice: a filled
 * button and an outlined one. The filled one is the glyph set's one
 * fill: what it shows is a solid button, and an outline cannot say that.
 *
 * @example
 * ```tsx
 * <ButtonFilledIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/button-style
 */

/** A solid button. */
export const ButtonFilledIcon = createIcon('ButtonFilledIcon', 'glyph', <rect x="3.5" y="7.5" width="17" height="9" rx="2.5" fill="currentColor" />);

/** An outlined button. */
export const ButtonOutlineIcon = createIcon('ButtonOutlineIcon', 'glyph', <rect x="3.5" y="7.5" width="17" height="9" rx="2.5" />);
