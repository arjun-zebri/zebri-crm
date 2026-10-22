import { createIcon } from './icon-base';

/**
 * Menu glyph: two even lines. For the button that opens a page's
 * navigation on a phone, where the links themselves do not fit.
 *
 * @example
 * ```tsx
 * <MenuIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/menu
 */
export const MenuIcon = createIcon(
  'MenuIcon',
  'glyph',
  <>
    <path d="M5 9h14M5 15h14" />
  </>,
);
