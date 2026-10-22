import { createIcon } from './icon-base';

/**
 * LinkedIn glyph: a soft rounded square holding a short "i" (stem and
 * dot) beside an "n" with a rounded shoulder. For a LinkedIn link or page.
 *
 * @example
 * ```tsx
 * <LinkedinIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/linkedin
 */
export const LinkedinIcon = createIcon(
  'LinkedinIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M8.5 11v5.5" />
    <path d="M8.5 8h0" />
    <path d="M11.75 16.5V11m0 2.25a2.25 2.25 0 0 1 4.5 0v3.25" />
  </>,
);
