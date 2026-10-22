import { createIcon } from './icon-base';

/**
 * Reviews glyph: a soft speech bubble holding two lines of what was said (lines, not quote marks: those read as a face at 14px). For what past clients said.
 *
 * @example
 * ```tsx
 * <ReviewsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/reviews
 */
export const ReviewsIcon = createIcon(
  'ReviewsIcon',
  'glyph',
  <>
    <path d="M7.5 17a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H12l-4.5 3.5z" />
    <path d="M8 9h8M8 12.5h5" />
  </>,
);
