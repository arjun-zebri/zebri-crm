import { createIcon } from './icon-base';

/**
 * Chat glyph: a round speech bubble with a tail at the bottom left. For a conversation or chat. Tail points are computed on the circle (2 decimals).
 *
 * @example
 * ```tsx
 * <ChatIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/chat
 */
export const ChatIcon = createIcon(
  'ChatIcon',
  'glyph',
  <>
    <path d="M8.41 19.7A8.5 8.5 0 1 0 4.3 15.59L3.5 20.5z" />
  </>,
);
