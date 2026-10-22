import { createIcon } from './icon-base';

/**
 * Documents glyph: a soft page, a title line over three lines of text.
 * For the Documents tab and anything that opens a document.
 *
 * @example
 * ```tsx
 * <DocumentsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/documents
 */
export const DocumentsIcon = createIcon(
  'DocumentsIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h7M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </>,
);
