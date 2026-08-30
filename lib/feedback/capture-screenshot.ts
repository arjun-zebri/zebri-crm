/**
 * Captures what the MC is looking at, minus the feedback UI itself.
 *
 * Uses `modern-screenshot`, which clones the DOM into an SVG
 * `foreignObject` and lets the browser rasterise it. That matters here:
 * Tailwind 4's default palette compiles to `oklch()`, and any library that
 * re-implements CSS painting (classic html2canvas) throws on it. Letting the
 * browser do the painting means modern colour functions cost us nothing.
 *
 * The feedback modal is excluded rather than hidden, so nothing flickers and
 * the page underneath is captured at full brightness with no backdrop dim.
 *
 * @module lib/feedback/capture-screenshot
 */
import { domToBlob } from 'modern-screenshot';

/**
 * Anything matching this is left out of the shot.
 *
 * Opted into by the Feedback pill, the feedback form (`Modal chrome`) and the
 * toast stack. Deliberately narrow: an ordinary modal IS usually the thing
 * being reported, so excluding every modal meant a screenshot taken from
 * inside one showed the page beneath instead of the bug. Excluding a node
 * skips its whole subtree.
 */
const EXCLUDE_SELECTOR = '[data-capture-hide]';

/** Matches the cap the API route and Notion both enforce. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Retina is nice to read but doubles the bytes; never go past 2x. */
const MAX_SCALE = 2;

/** A 1x1 transparent PNG, stood in for any image we cannot fetch. */
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function isExcluded(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(EXCLUDE_SELECTOR);
}

/** Filenames like `zebri-payments-2026-08-29T04-12-00.png`. */
function screenshotName(): string {
  const route = window.location.pathname.replace(/^\/|\/$/g, '').replace(/\W+/g, '-') || 'dashboard';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `zebri-${route}-${stamp}.png`;
}

async function snapshot(scale: number): Promise<Blob> {
  return domToBlob(document.body, {
    type: 'image/png',
    scale,
    width: window.innerWidth,
    height: window.innerHeight,
    filter: (node) => !isExcluded(node),
    // The body is usually transparent, which would rasterise to black.
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    // A branding logo served from Supabase Storage can fail CORS. A missing
    // logo is not a reason to lose the whole screenshot.
    fetch: { placeholderImage: TRANSPARENT_PIXEL },
  });
}

/**
 * Takes a PNG of the current viewport.
 *
 * @returns A `File` ready to attach to a report.
 * @throws If the browser cannot rasterise the page at all.
 */
export async function captureViewport(): Promise<File> {
  const scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE);
  let blob = await snapshot(scale);

  // A wide retina viewport can clear 5MB on a busy page. Falling back to 1x
  // keeps the shot rather than rejecting it at the upload step.
  if (blob.size > MAX_BYTES && scale > 1) blob = await snapshot(1);

  return new File([blob], screenshotName(), { type: 'image/png' });
}
