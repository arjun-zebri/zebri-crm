import { createIcon } from './icon-base';

/**
 * Message text glyph: the Reviews soft bubble with a short line over a long one. For a written message or note.
 *
 * @example
 * ```tsx
 * <MessageTextIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/message-text
 */
export const MessageTextIcon = createIcon(
  'MessageTextIcon',
  'glyph',
  <>
    <path d="M7.5 17a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H12l-4.5 3.5z" />
    <path d="M8 9h5M8 12.5h8" />
  </>,
);
