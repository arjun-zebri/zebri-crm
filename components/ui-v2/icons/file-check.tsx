import { createIcon } from './icon-base';

/**
 * File check glyph: the Documents soft rect with a check. For an approved, signed or complete file.
 *
 * @example
 * ```tsx
 * <FileCheckIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/file-check
 */
export const FileCheckIcon = createIcon(
  'FileCheckIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 12l2.5 2.5L15.5 10" />
  </>,
);
