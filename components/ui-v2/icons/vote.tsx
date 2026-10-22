import { createIcon } from './icon-base';

/**
 * Vote glyph: a soft card with an upvote arrow, a feature voted up. For
 * voting on what gets built, or upvoting a request.
 *
 * @example
 * ```tsx
 * <VoteIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/vote
 */
export const VoteIcon = createIcon(
  'VoteIcon',
  'glyph',
  <>
    <rect x="4.5" y="3" width="15" height="18" rx="4" />
    <path d="M8.5 11.5 12 8l3.5 3.5" />
    <path d="M12 8v8.5" />
  </>,
);
