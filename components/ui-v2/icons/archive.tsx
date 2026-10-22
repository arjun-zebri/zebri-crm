import { createIcon } from './icon-base';

/**
 * Archive glyph: a soft box under a lid, with a handle slot. For archiving.
 *
 * @example
 * ```tsx
 * <ArchiveIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/archive
 */
export const ArchiveIcon = createIcon(
  'ArchiveIcon',
  'glyph',
  <>
    <rect x="3" y="3.5" width="18" height="5" rx="1.5" />
    <path d="M4.5 8.5v8a4 4 0 0 0 4 4h7a4 4 0 0 0 4-4v-8" />
    <path d="M10 12.5h4" />
  </>,
);
