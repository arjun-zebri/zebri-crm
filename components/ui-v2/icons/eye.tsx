import { createIcon } from './icon-base';

/**
 * Eye glyph: an almond eye with a round iris. For show, preview and visible.
 *
 * @example
 * ```tsx
 * <EyeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/eye
 */
export const EyeIcon = createIcon(
  'EyeIcon',
  'glyph',
  <>
    <path d="M3 12c2-4 5-6.5 9-6.5s7 2.5 9 6.5c-2 4-5 6.5-9 6.5S5 16 3 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </>,
);
