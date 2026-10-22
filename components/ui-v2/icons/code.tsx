import { createIcon } from './icon-base';

/**
 * Code glyph: a pair of angle brackets. For code or embed.
 *
 * @example
 * ```tsx
 * <CodeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/code
 */
export const CodeIcon = createIcon(
  'CodeIcon',
  'glyph',
  <>
    <path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5" />
  </>,
);
