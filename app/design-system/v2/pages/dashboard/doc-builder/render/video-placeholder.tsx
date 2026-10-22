import { ImageIcon, PlayIcon, VideoIcon } from '@/components/ui-v2/icons';

/**
 * Where the MC's video hello goes, before they have added one: a 16:9
 * slot in their brand colour with a play button and a "Your video" tag,
 * as the original onboarding proposal drew it (`onboarding/proposal-media`
 * `VideoSlot`; founder, 2026-10-08: "it had a video section"). Shown only
 * where the MC is looking (Ready to send, template cards). The couple's
 * page leaves an empty video out, as production does, so a couple never
 * sees an empty box.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/render/video-placeholder
 */

/** The slot. `brand` is the MC's brand colour as a hex. */
export function VideoPlaceholder({ brand }: { brand: string }) {
  return (
    <div
      // The MC's brand colour, falling to near black: a runtime colour, so set inline.
      style={{ background: `linear-gradient(160deg, ${brand}, color-mix(in oklab, ${brand}, black 55%))` }}
      className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-check"
    >
      <span aria-hidden="true" className="grid size-14 place-items-center rounded-pill bg-field text-zebra-950 shadow-lg">
        <PlayIcon className="size-5 translate-x-px fill-current" />
      </span>
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-pill bg-zebra-950/35 px-2.5 py-0.5 type-body text-zebra-50">
        <VideoIcon aria-hidden="true" className="size-3.5" />
        Your video
      </span>
    </div>
  );
}

/**
 * Where the MC's photos go, before they add any: the original page's
 * mosaic, one lead tile in the brand colour and two lighter beside it.
 * Like the video slot, only the MC sees it; a couple's page leaves an
 * empty gallery out.
 */
export function GalleryPlaceholder({ brand }: { brand: string }) {
  const tile = 'grid place-items-center overflow-hidden rounded-check';
  return (
    <div className="grid h-52 grid-cols-3 grid-rows-2 gap-2">
      {/* Brand-colour washes: runtime colours, so set inline. */}
      <div style={{ background: `linear-gradient(160deg, ${brand}, color-mix(in oklab, ${brand}, black 55%))` }} className={`col-span-2 row-span-2 ${tile}`}>
        <ImageIcon aria-hidden="true" className="size-5 text-zebra-50 opacity-70" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} style={{ background: `color-mix(in oklab, ${brand} 14%, white)` }} className={tile}>
          <ImageIcon aria-hidden="true" className="size-5 text-zebra-500 opacity-60" />
        </div>
      ))}
      <span className="sr-only">Your photos</span>
    </div>
  );
}
