'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { ArrowLeftIcon, DesktopIcon, MobileIcon } from '@/components/ui-v2/icons';
import { Segmented } from '@/components/ui-v2/segmented';

import { CouplePage } from '../../doc-builder/render/couple-page';
import type { DocEditor, Device } from '../../doc-builder/state/use-doc-editor';

/**
 * Preview: the page exactly as the couple will meet it, live (packages
 * pick, questions open, sections reveal), on a desktop or a phone's
 * width, with no editing chrome at all. Over the editor, full screen;
 * Back, or Escape, returns to editing where the MC was.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/preview-overlay
 */

export interface PreviewOverlayProps {
  open: boolean;
  onClose: () => void;
  builder: DocEditor;
}

/** The preview. See {@link PreviewOverlayProps}. */
export function PreviewOverlay({ open, onClose, builder }: PreviewOverlayProps) {
  const [device, setDevice] = useState<Device>(builder.device);
  // The page wears the look it would be sent in.
  const layout = { ...builder.state.layout, theme: builder.theme };
  return (
    <Dialog open={open} onClose={onClose} size="screen" aria-labelledby="preview-title">
      {open ? (
        <>
          <header className="flex items-center gap-3 px-4 py-3 md:px-5">
            <Button variant="ghost" icon={<ArrowLeftIcon aria-hidden="true" className="size-4" />} onClick={onClose}>
              Back to editing
            </Button>
            <h2 id="preview-title" className="min-w-0 flex-1 truncate text-center type-label text-zebra-950">
              What {builder.doc.coupleName} will see
            </h2>
            <Segmented<Device> label="Show on" options={['desktop', 'phone']} labels={{ desktop: 'Desktop', phone: 'Phone' }} icons={{ desktop: DesktopIcon, phone: MobileIcon }} value={device} onChange={setDevice} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 px-4 py-8">
            <div className={`mx-auto overflow-hidden rounded-check bg-field shadow-lg ring-1 ring-hairline transition-[max-width] duration-300 ease-glide motion-reduce:transition-none ${device === 'phone' ? 'max-w-[390px]' : 'max-w-[1100px]'}`}>
              <CouplePage layout={layout} branding={builder.branding} doc={builder.doc} terms={builder.terms} mode="page" />
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
