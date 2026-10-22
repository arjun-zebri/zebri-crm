import { createIcon } from './icon-base';

/**
 * Lodge with BDM glyph: a soft page with a title line over a ticked
 * circle, the marriage paperwork lodged and done. For the Lodge with BDM
 * block: its Blocks row, the Marriage paperwork kind, the paperwork
 * dialog, its Settings tab and the Registry's notifications.
 *
 * @example
 * ```tsx
 * <BdmIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/bdm
 */
export const BdmIcon = createIcon(
  'BdmIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h7" />
    <circle cx="12" cy="14.5" r="3.5" />
    <path d="M10.5 14.5l1 1 2-2" />
  </>,
);
