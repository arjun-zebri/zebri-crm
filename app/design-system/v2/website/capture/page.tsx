import type { Metadata } from 'next';

import { CaptureSheet } from '../../pages/website/capture/capture-sheet';

/**
 * Dev-only sheet of the marketing site's product pictures, photographed by
 * zebri-landing's capture script. See {@link CaptureSheet}.
 *
 * @module app/design-system/v2/website/capture/page
 */

export const metadata: Metadata = { title: 'Website pictures · Zebri' };

export default function WebsiteCapturePage() {
  return <CaptureSheet />;
}
