import { createIcon } from './icon-base';

/**
 * Bring To Front glyph: a whole square in front of two half-hidden ones. For bring to front.
 *
 * @example
 * ```tsx
 * <BringToFrontIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/bring-to-front
 */
export const BringToFrontIcon = createIcon(
  'BringToFrontIcon',
  'glyph',
  <>
    <rect x="8.5" y="8.5" width="7" height="7" rx="2" />
    <path d="M6.5 10.5h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" />
    <path d="M17.5 13.5h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-1" />
  </>,
);
