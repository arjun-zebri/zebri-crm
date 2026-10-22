'use client';

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui-v2/button';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { IdCardIcon, SpinnerIcon } from '@/components/ui-v2/icons';

/**
 * The photo half of the couple's ID step (`id-capture.tsx`), the way
 * Stripe Identity and the banks do it (user, 2026-10-15): a frame asking
 * for a photo of the document, Take a photo (the phone's camera, via
 * `capture`) or Upload one, and while it is "read", the photo with a
 * band sweeping over it. Demo only: nothing is uploaded or read; the
 * photo stays in the browser and the details are made up
 * (`id-capture.tsx`). The live app would send it to an ID-reading
 * service and never keep the image.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/id-photo
 */

export interface IdPhotoAskProps {
  /** The document, as the frame names it: "passport", "birth certificate". */
  doc: string;
  onPhoto: (url: string) => void;
  /** Skips the photo for typing the details in. */
  onType: () => void;
}

/** The frame asking for a photo. See {@link IdPhotoAskProps}. */
export function IdPhotoAsk({ doc, onPhoto, onType }: IdPhotoAskProps) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const take = (file: File | undefined) => file && onPhoto(URL.createObjectURL(file));
  return (
    <div className="flex flex-col items-center gap-4 rounded-panel border border-dashed border-zebra-300 bg-zebra-50 px-6 py-8 text-center">
      <IconCircle icon={IdCardIcon} size="lg" />
      <div className="space-y-1">
        <p className="type-label text-zebra-950">Take a photo of your {doc}</p>
        <p className="type-body text-zebra-500">Lay it flat in good light, with all four corners in view. We read the details from it, so you do not have to type them.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => camera.current?.click()}>Take a photo</Button>
        <Button variant="secondary" onClick={() => upload.current?.click()}>
          Upload a photo
        </Button>
      </div>
      <Button variant="text" onClick={onType}>
        Type the details in instead
      </Button>
      {/* The camera on a phone; a file picker on a computer, which has no `capture`. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => take(e.target.files?.[0])} />
      <input ref={upload} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}

/** How long the pretend read takes: long enough to see it working, short enough not to wait on. */
const READ_MS = 1800;

/** The photo being read, then `onRead`. */
export function IdPhotoReading({ url, doc, onRead }: { url: string; doc: string; onRead: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onRead, READ_MS);
    return () => window.clearTimeout(t);
  }, [onRead]);
  return (
    <div className="space-y-3">
      <div className="relative aspect-[1.6] overflow-hidden rounded-panel bg-zebra-100 ring-1 ring-hairline">
        {/* An object URL of the couple's own photo: next/image cannot take it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Your ${doc}`} className="size-full object-cover" />
        <span aria-hidden="true" className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-grass-400/40 to-transparent motion-safe:animate-scan" />
      </div>
      <p role="status" className="flex items-center justify-center gap-2 type-body text-zebra-600">
        <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
        Reading your {doc}
      </p>
    </div>
  );
}
