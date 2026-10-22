import { createIcon } from './icon-base';

/**
 * Quote glyph: two soft quote marks. For a quote block.
 *
 * @example
 * ```tsx
 * <QuoteIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/quote
 */
export const QuoteIcon = createIcon(
  'QuoteIcon',
  'glyph',
  <>
    <path d="M10.5 11.5h-4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5a4 4 0 0 1-4 4" />
    <path d="M19.5 11.5h-4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5a4 4 0 0 1-4 4" />
  </>,
);
