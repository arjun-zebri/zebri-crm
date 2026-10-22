import { createIcon } from './icon-base';

/**
 * Text section glyph: a soft square holding a capital T. For adding a text section to a document.
 *
 * @example
 * ```tsx
 * <TextSectionIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/text-section
 */
export const TextSectionIcon = createIcon(
  'TextSectionIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8.5 8.5h7M12 8.5v7.5" />
  </>,
);
