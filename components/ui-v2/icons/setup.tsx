import { createIcon } from './icon-base';

/**
 * Set up glyph: a sprout, two soft leaves on a stem, an account starting
 * to grow. For getting an account set up (the getting-started list).
 *
 * @example
 * ```tsx
 * <SetupIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/setup
 */
export const SetupIcon = createIcon(
  'SetupIcon',
  'glyph',
  <>
    <path d="M12.5 19.25v-9.5" />
    <path d="M12.5 11.75c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6zM12.5 9.75c0-3 2-5 5.5-5 0 3-2 5-5.5 5z" />
  </>,
);
