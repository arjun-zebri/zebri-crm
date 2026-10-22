import { createIcon } from './icon-base';

/**
 * Globe glyph: a circle with a meridian ellipse and an equator. For a website, language or worldwide.
 *
 * @example
 * ```tsx
 * <GlobeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/globe
 */
export const GlobeIcon = createIcon(
  'GlobeIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a4 8.5 0 0 0 0 17 4 8.5 0 0 0 0-17" />
    <path d="M3.5 12h17" />
  </>,
);
