import { createIcon } from './icon-base';

/**
 * Blocks glyph: three soft tiles with a plus in the fourth place, for
 * adding a feature. For the Blocks catalogue and anything that opens it.
 *
 * @example
 * ```tsx
 * <BlocksIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/blocks
 */
export const BlocksIcon = createIcon(
  'BlocksIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <path d="M17 13.5v7M13.5 17h7" />
  </>,
);
