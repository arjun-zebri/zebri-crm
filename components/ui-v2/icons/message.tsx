import { createIcon } from './icon-base';

/**
 * Message glyph: the Reviews soft bubble, empty. For a message or comment.
 *
 * @example
 * ```tsx
 * <MessageIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/message
 */
export const MessageIcon = createIcon(
  'MessageIcon',
  'glyph',
  <>
    <path d="M7.5 17a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H12l-4.5 3.5z" />
  </>,
);
