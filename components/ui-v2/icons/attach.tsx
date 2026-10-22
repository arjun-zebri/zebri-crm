import { createIcon } from './icon-base';

/**
 * Attach glyph: a soft two-loop paperclip, tilted 45 degrees. The
 * outline is computed (exact lines and arcs, rotated), so its
 * coordinates are off the half-unit grid by design. For attaching a
 * file.
 *
 * @example
 * ```tsx
 * <AttachIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/attach
 */
export const AttachIcon = createIcon(
  'AttachIcon',
  'glyph',
  <>
    <path d="M17.46 12.2L12.16 17.5A3.5 3.5 0 0 1 7.21 12.55L13.57 6.19A2.5 2.5 0 0 1 17.11 9.72L11.45 15.38" />
  </>,
);
