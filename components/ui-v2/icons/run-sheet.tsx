import { createIcon } from './icon-base';

/**
 * Run sheet glyph: a soft clipboard of numbered rows, 1 and 2, each with
 * a line for its moment. Two rows, not three: at stroke 1.5 a third
 * numeral will not fit the clipboard and still read at 16px. For the run sheet document and anything
 * that opens one.
 *
 * @example
 * ```tsx
 * <RunSheetIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/run-sheet
 */
export const RunSheetIcon = createIcon(
  'RunSheetIcon',
  'glyph',
  <>
    <rect x="4.5" y="4" width="15" height="18" rx="4" />
    <path d="M9.5 4a2.5 2.5 0 0 1 5 0" />
    <path d="M8.1 10.48l1.26 -0.98v3.5 M7.75 16.12a1.22 1.12 0 1 1 2.45 0c0 1.12 -2.45 1.68 -2.45 2.38h2.45" />
    <path d="M11.5 11.25h4M11.5 16.75h2.5" />
  </>,
);


