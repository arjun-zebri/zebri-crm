import { createIcon } from './icon-base';

/**
 * Expand glyph: two arrows pointing out from a dashed middle line. For
 * expanding collapsed rows or sections.
 *
 * @example
 * ```tsx
 * <ExpandIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/expand
 */
export const ExpandIcon = createIcon(
  'ExpandIcon',
  'glyph',
  <>
    <path d="M12 9V3.5M8.5 7 12 3.5 15.5 7M12 15v5.5M8.5 17l3.5 3.5 3.5-3.5" />
    <path d="M4.5 12h2M10.5 12h3M17.5 12h2" />
  </>,
);
