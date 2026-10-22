import { createIcon } from './icon-base';

/**
 * Flag glyph: a wavy flag on a pole. For flagging, marking and milestones.
 *
 * @example
 * ```tsx
 * <FlagIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/flag
 */
export const FlagIcon = createIcon(
  'FlagIcon',
  'glyph',
  <>
    <path d="M5 21V4.5s1.5-1 3.5-1c3 0 4 2 7 2 2 0 3.5-1 3.5-1v10s-1.5 1-3.5 1c-3 0-4-2-7-2-2 0-3.5 1-3.5 1" />
  </>,
);
