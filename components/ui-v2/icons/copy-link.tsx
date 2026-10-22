import { createIcon } from './icon-base';

/**
 * Copy link glyph: two soft squares, one behind the other. For copying a
 * link or duplicating something.
 *
 * @example
 * ```tsx
 * <CopyLinkIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/copy-link
 */
export const CopyLinkIcon = createIcon(
  'CopyLinkIcon',
  'glyph',
  <>
    <rect x="8" y="8" width="12.5" height="12.5" rx="3.5" />
    <path d="M15.5 8V6.5a3 3 0 0 0-3-3h-6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3H8" />
  </>,
);
