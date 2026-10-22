import { createIcon } from './icon-base';

/**
 * Enquiries glyph: a soft speech bubble with three dots, someone asking.
 * For Enquiries and anything that opens a new enquiry.
 *
 * @example
 * ```tsx
 * <EnquiriesIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/enquiries
 */
export const EnquiriesIcon = createIcon(
  'EnquiriesIcon',
  'glyph',
  <>
    <rect x="3" y="4" width="18" height="12.5" rx="4" />
    <path d="M8 16.5v4l4-4" />
    <path d="M8.5 10.25h0M12 10.25h0M15.5 10.25h0" />
  </>,
);
