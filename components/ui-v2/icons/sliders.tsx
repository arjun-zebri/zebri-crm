import { createIcon } from './icon-base';

/**
 * Sliders glyph: three horizontal tracks, each with a round knob. For
 * adjusting settings or display options.
 *
 * @example
 * ```tsx
 * <SlidersIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/sliders
 */
export const SlidersIcon = createIcon(
  'SlidersIcon',
  'glyph',
  <>
    <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h7M15 17.5h5" />
    <circle cx="15" cy="6.5" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="13" cy="17.5" r="2" />
  </>,
);
