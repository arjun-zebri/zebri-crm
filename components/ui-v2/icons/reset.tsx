import { createIcon } from './icon-base';

/**
 * Reset glyph: a circular arrow turning anticlockwise. For resetting to the
 * default or starting over.
 *
 * @example
 * ```tsx
 * <ResetIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/reset
 */
export const ResetIcon = createIcon(
  'ResetIcon',
  'glyph',
  <>
    <path d="M4 12a8 8 0 1 0 8-8 8.5 8.5 0 0 0-6 2.5L4 8.5" />
    <path d="M4 4v4.5h4.5" />
  </>,
);
