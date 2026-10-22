'use client';

import { EmptyState } from '@/components/ui-v2/empty-state';
import { PhotosIcon } from '@/components/ui-v2/icons';

import { useBrandKit } from '../../brand/brand-provider';

/**
 * The pictures the editor offers wherever one is wanted (a section's
 * background, an image in the text, the gallery): the brand kit's photos.
 * There is no stock library: the demo used to offer `public/wedding/`,
 * the founder's own wedding photos (kept for production's welcome step),
 * and they ended up on every starter template (founder, 2026-10-08:
 * "photos of my own personal wedding"). Every one is an absolute
 * http(s) URL: production's renderer draws nothing else (a guard against
 * `javascript:` and `data:` sources), and the preview has no storage to
 * turn an upload into one, so the editor offers no upload here; the
 * real build uploads to storage as production's editor does.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/photos
 */

export interface Photo {
  src: string;
  name: string;
}

/** The kit's photos the page can draw. */
export function usePhotos(): Photo[] {
  const { kit } = useBrandKit();
  return kit.assets.filter((a) => /^https?:\/\//.test(a.src)).map((a) => ({ src: a.src, name: a.name }));
}

export interface PhotoGridProps {
  photos: Photo[];
  /** The one in use, ringed. */
  value?: string | null | undefined;
  onPick: (src: string) => void;
}

/** A tight grid of photos to pick from. */
export function PhotoGrid({ photos, value, onPick }: PhotoGridProps) {
  // With no stock library, a new account has none until they add their own.
  if (!photos.length) return <EmptyState compact icon={PhotosIcon} title="No photos yet" body="Add photos in Global styling to use them here." />;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {photos.map((p) => (
        <button
          key={p.src}
          type="button"
          aria-label={p.name}
          aria-pressed={value === p.src}
          onClick={() => onPick(p.src)}
          className={`aspect-square overflow-hidden rounded-button transition-opacity duration-150 hover:opacity-90 focus-mark motion-reduce:transition-none ${value === p.src ? 'ring-2 ring-selected' : ''}`}
        >
          {/* The MC's own photo, from any host: next/image takes only configured ones. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="" className="size-full object-cover" />
        </button>
      ))}
    </div>
  );
}
