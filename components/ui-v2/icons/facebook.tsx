import { createIcon } from './icon-base';

/**
 * Facebook glyph: a soft rounded square with the lowercase f running off
 * its foot, the crossbar at two thirds. For a Facebook link or page.
 *
 * @example
 * ```tsx
 * <FacebookIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/facebook
 */
export const FacebookIcon = createIcon(
  'FacebookIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M15.5 8h-1.25A2.25 2.25 0 0 0 12 10.25V20.5" />
    <path d="M9.5 13h5.5" />
  </>,
);
