import { createIcon } from './icon-base';

/**
 * Source glyph: a soft magnet, what draws clients in, for where a client
 * found the MC.
 *
 * @example
 * ```tsx
 * <SourceIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/source
 */
export const SourceIcon = createIcon(
  'SourceIcon',
  'glyph',
  <>
    <path d="M5 4h4v7.5a3 3 0 0 0 6 0V4h4v7.5a7 7 0 0 1-14 0z" />
    <path d="M5 8h4M15 8h4" />
  </>,
);
