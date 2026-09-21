'use client'

/**
 * The image library's thumbnail grid (`../image-insert-modal.tsx`): one
 * square button per uploaded image. A real `<button>` (unlike
 * `LibraryItemCard`'s `div role="button"`) since a thumbnail never needs
 * to nest another interactive element.
 *
 * @module features/proposals/editor/library/library-image-grid
 */
import type { ProposalImage } from '../../data/media'

/** Props for {@link LibraryImageGrid}. */
export interface LibraryImageGridProps {
  images: readonly ProposalImage[]
  /** Called with the clicked image's public URL. */
  onInsert: (url: string) => void
}

/** Three-column grid of square image thumbnails; clicking one inserts it into the page. */
export function LibraryImageGrid({ images, onInsert }: LibraryImageGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((img) => (
        <button
          key={img.url}
          type="button"
          aria-label={`Insert ${img.name}`}
          onClick={() => onInsert(img.url)}
          className="aspect-square overflow-hidden rounded-control border border-border bg-surface-muted transition-shadow hover:ring-2 hover:ring-brand-fg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- MC-uploaded library thumbnail */}
          <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  )
}
