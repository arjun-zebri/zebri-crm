import { createIcon } from './icon-base';

/**
 * Fill glyph: a tipped paint bucket with its handle and a drop falling from the lip. For fill colour.
 *
 * @example
 * ```tsx
 * <FillIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/fill
 */
export const FillIcon = createIcon(
  'FillIcon',
  'glyph',
  <>
    <path d="M12 4 5 11q-1 1 0 2l5 5q1 1 2 0l7-7z" />
    <path d="M6.5 2.5 10 6" />
    <path d="M21.5 19a1.5 1.5 0 0 1-3 0c0-1.5 1.5-2.5 1.5-4 0 1.5 1.5 2.5 1.5 4z" />
  </>,
);
