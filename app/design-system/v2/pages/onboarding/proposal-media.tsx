import { ImageIcon, Play } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Photo and video placeholders for the brand step's sample proposal.
 * A real proposal opens on a full-bleed photo and a short video, so the
 * sample does too, with brand-tinted stand-ins where the MC's own media
 * will go. The video carries a small "Your video" tag, so it reads as a
 * slot waiting to be filled rather than a broken embed.
 *
 * Colours come from the brand custom properties set by `BrandPreview`.
 *
 * @module app/design-system/v2/pages/onboarding/proposal-media
 */

// The brand colour falling to near black: stands in for a moody photo,
// and keeps white text readable whatever brand colour is picked.
const DEEP = 'bg-[linear-gradient(160deg,var(--b-primary),color-mix(in_oklab,var(--b-primary),black_55%))]';
// A lighter wash from the accent, for the portrait and gallery slots.
const SOFT = 'bg-[linear-gradient(145deg,var(--b-secondary),color-mix(in_oklab,var(--b-secondary),var(--b-primary)_22%))]';

/** The small "what goes here" tag in a placeholder's corner. */
function SlotTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-zebra-950/35 px-2.5 py-0.5 type-body text-zebra-50 backdrop-blur-sm">
      <ImageIcon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
      {children}
    </span>
  );
}

/** The cover: a full-bleed photo slot with the page's title low over it. */
export function CoverPhoto({ children }: { children: ReactNode }) {
  return (
    <div className={`relative flex min-h-80 flex-col justify-end overflow-hidden p-8 text-zebra-50 transition-colors duration-500 ${DEEP}`}>
      {/* Soft light from the top corner, like a photo's highlights. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgb(255_255_255/0.22),transparent_60%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A 16:9 video slot with a play button in the brand colour. */
export function VideoSlot({ caption }: { caption: string }) {
  return (
    <figure className="space-y-2">
      <div className={`relative grid aspect-video place-items-center overflow-hidden rounded-check ${DEEP}`}>
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_55%)]" />
        <span aria-hidden="true" className="relative grid size-12 place-items-center rounded-pill bg-field text-[var(--b-primary)] shadow-lg">
          <Play strokeWidth={1.5} className="size-5 translate-x-px fill-current" />
        </span>
        <span aria-hidden="true" className="absolute bottom-3 left-3">
          <SlotTag>Your video</SlotTag>
        </span>
      </div>
      <figcaption className="type-body text-zebra-500">{caption}</figcaption>
    </figure>
  );
}

/** A round portrait slot for the MC's photo, beside their sign-off. */
export function Portrait() {
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-500 ${SOFT}`}>
      <ImageIcon aria-hidden="true" strokeWidth={1.5} className="size-4 text-[var(--b-primary)] opacity-60" />
    </span>
  );
}

/**
 * A photo slot for the gallery. `deep` is the brand colour (the lead
 * photo), otherwise the accent wash, so a mosaic of them reads as a set
 * of different pictures rather than one tile repeated.
 */
export function PhotoTile({ label, deep = false, className = '' }: { label: string; deep?: boolean; className?: string }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-check transition-colors duration-500 ${deep ? DEEP : SOFT} ${className}`}>
      <ImageIcon aria-hidden="true" strokeWidth={1.5} className={`size-5 ${deep ? 'text-zebra-50 opacity-70' : 'text-[var(--b-primary)] opacity-50'}`} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
