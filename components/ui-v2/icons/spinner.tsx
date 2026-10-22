import { createIcon } from './icon-base';

/**
 * Spinner glyph: an open three-quarter arc. Use with `animate-spin` for loading.
 *
 * @example
 * ```tsx
 * <SpinnerIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/spinner
 */
export const SpinnerIcon = createIcon(
  'SpinnerIcon',
  'glyph',
  <>
    <path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5" />
  </>,
);
