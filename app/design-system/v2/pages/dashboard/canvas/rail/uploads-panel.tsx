'use client';

import { AddTile } from '@/components/ui-v2/add-tile';
import { FileDrop } from '@/components/ui-v2/file-drop';

import { readImage } from '../../brand/kit-edit';

import type { RailApi } from './api';
import { putPicture } from './picture';

/**
 * The Uploads tab: pictures added while designing (the couple's
 * engagement photo, the venue), one click from the page. Photos meant
 * for every document belong in the brand kit instead.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/uploads-panel
 */

/** An uploaded picture. */
export interface Upload {
  id: string;
  name: string;
  src: string;
}

export interface UploadsPanelProps {
  api: RailApi;
  uploads: Upload[];
  onUpload: (u: Upload) => void;
}

/** The Uploads tab. */
export function UploadsPanel({ api, uploads, onUpload }: UploadsPanelProps) {
  return (
    <div className="space-y-4">
      <FileDrop
        label="Upload a picture"
        help="JPG, PNG or SVG"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onFile={(file) => readImage(file, (src) => onUpload({ id: `${Date.now()}`, name: file.name, src }))}
      />
      {uploads.length ? (
        <div className="grid grid-cols-2 gap-2">
          {uploads.map((u) => (
            <AddTile key={u.id} label={`Add ${u.name}`} onAdd={() => putPicture(api, u.src)}>
              {/* An upload, as a data URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.src} alt="" className="size-full object-cover" />
            </AddTile>
          ))}
        </div>
      ) : null}
    </div>
  );
}
