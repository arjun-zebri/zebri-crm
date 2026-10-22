import { createIcon } from './icon-base';

/**
 * Link glyph: a chain link: two open loops joined by a bar. For a hyperlink (not CopyLink, which is two squares).
 *
 * @example
 * ```tsx
 * <LinkIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/link
 */
export const LinkIcon = createIcon(
  'LinkIcon',
  'glyph',
  <>
    <path d="M9.5 7.5h-2a4.5 4.5 0 0 0 0 9h2M14.5 7.5h2a4.5 4.5 0 0 1 0 9h-2" />
    <path d="M8.5 12h7" />
  </>,
);
