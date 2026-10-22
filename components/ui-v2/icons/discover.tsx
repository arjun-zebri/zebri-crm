import { createIcon } from './icon-base';

/**
 * Discover glyph: a soft gift, a feature not unwrapped yet. For Discover
 * Zebri, the quick start that shows the MC one feature they have not
 * used yet, on the real page.
 *
 * @example
 * ```tsx
 * <DiscoverIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/discover
 */
export const DiscoverIcon = createIcon(
  'DiscoverIcon',
  'glyph',
  <>
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="3" />
    <path d="M12 7.5V19M3.5 12h17" />
    <path d="M12 7.5c-1-3-5-3.5-5-1s3 1 5 1zM12 7.5c1-3 5-3.5 5-1s-3 1-5 1z" />
  </>,
);
