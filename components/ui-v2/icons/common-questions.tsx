import { createIcon } from './icon-base';

/**
 * Common questions glyph: a soft square holding a question mark. For the questions every client asks.
 *
 * @example
 * ```tsx
 * <CommonQuestionsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/common-questions
 */
export const CommonQuestionsIcon = createIcon(
  'CommonQuestionsIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M9.75 9.75a2.25 2.25 0 1 1 3.4 1.93c-.68.4-1.15.87-1.15 1.57v.5M12 16.25h0" />
  </>,
);
