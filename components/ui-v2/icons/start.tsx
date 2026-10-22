import { createIcon } from './icon-base';

/**
 * Start glyph: a straight arrow pointing right. For starting something off, as opposed to the chevron that opens.
 *
 * @example
 * ```tsx
 * <StartIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/start
 */
export const StartIcon = createIcon(
  'StartIcon',
  'glyph',
  <>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </>,
);
