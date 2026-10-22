import { createIcon } from './icon-base';

/**
 * Pause glyph: two soft upright bars. For pausing media.
 *
 * @example
 * ```tsx
 * <PauseIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/pause
 */
export const PauseIcon = createIcon(
  'PauseIcon',
  'glyph',
  <>
    <rect x="6" y="4.5" width="4" height="15" rx="1.5" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.5" />
  </>,
);
