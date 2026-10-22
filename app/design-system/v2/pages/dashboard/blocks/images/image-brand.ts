import { BRAND } from '../../proposals/templates-data';

/**
 * The brand the couple-facing block images (Proposals, Payments) wear: the
 * default look in a lighter green (grass-500 with a grass-100 wash, as hex
 * since brand colours are data), so the documents do not echo the Blocks
 * dialog's dark green primary button beside them.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/image-brand
 */

/** The light green brand for block images. */
export const IMAGE_BRAND = { ...BRAND, primary: '#5fa932', secondary: '#e3f4d3' };
