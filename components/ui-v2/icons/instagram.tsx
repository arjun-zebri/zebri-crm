import { createIcon } from './icon-base';

/**
 * Instagram glyph: a soft rounded square camera with a round lens and a dot. For an Instagram link or handle.
 *
 * @example
 * ```tsx
 * <InstagramIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/instagram
 */
export const InstagramIcon = createIcon(
  'InstagramIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M16.5 7.5h0" />
  </>,
);
