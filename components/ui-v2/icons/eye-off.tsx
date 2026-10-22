import { createIcon } from './icon-base';

/**
 * Eye off glyph: the EyeIcon crossed by a slash. For hide and hidden.
 *
 * @example
 * ```tsx
 * <EyeOffIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/eye-off
 */
export const EyeOffIcon = createIcon(
  'EyeOffIcon',
  'glyph',
  <>
    <path d="M3 12c2-4 5-6.5 9-6.5s7 2.5 9 6.5c-2 4-5 6.5-9 6.5S5 16 3 12z" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M4 4l16 16" />
  </>,
);
