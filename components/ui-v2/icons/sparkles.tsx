import { createIcon } from './icon-base';

/**
 * Sparkles glyph: a large four-point sparkle with a small plus beside it. For
 * AI and suggested content.
 *
 * @example
 * ```tsx
 * <SparklesIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/sparkles
 */
export const SparklesIcon = createIcon(
  'SparklesIcon',
  'glyph',
  <>
    <path d="M10 6.5c0 4 3 7 7 7-4 0-7 3-7 7 0-4-3-7-7-7 4 0 7-3 7-7z" />
    <path d="M18 3.5v5M15.5 6h5" />
  </>,
);
