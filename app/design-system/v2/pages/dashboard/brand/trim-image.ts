/**
 * Trims the empty margin off an uploaded logo, so its box on the page
 * hugs the logo and its resize handle sits on the logo's corner (founder,
 * 2026-10-21: a lemon in a square of white read as a logo floating in a
 * box far bigger than it). The background is what the corners share:
 * see-through, or one flat colour (a logo exported on white). Pixels
 * close to it count as margin; a small gap is kept round what is left.
 * An SVG is kept as it is, since redrawing it would lose its sharpness,
 * and so is an image that is all margin or that cannot be read.
 *
 * @module app/design-system/v2/pages/dashboard/brand/trim-image
 */

/** How far a pixel's colour may stray from the background's and still count as margin, per channel. */
const TOLERANCE = 24;
/** The gap kept round the logo, as a share of its larger side. */
const GAP = 0.04;

/** Whether pixel `i` of `px` is margin: see-through, or close to the background `bg`. */
function isMargin(px: Uint8ClampedArray, i: number, bg: [number, number, number, number]) {
  const a = px[i + 3]!;
  if (a < 16) return true;
  if (bg[3] < 16) return false;
  return Math.abs(px[i]! - bg[0]) <= TOLERANCE && Math.abs(px[i + 1]! - bg[1]) <= TOLERANCE && Math.abs(px[i + 2]! - bg[2]) <= TOLERANCE;
}

/** The box round everything that is not margin, or null when it is all margin. */
function contentBox(px: Uint8ClampedArray, w: number, h: number) {
  const bg: [number, number, number, number] = [px[0]!, px[1]!, px[2]!, px[3]!];
  let top = h;
  let left = w;
  let bottom = -1;
  let right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isMargin(px, (y * w + x) * 4, bg)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return bottom < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** `src` (a data URL) with its empty margin trimmed, handed to `done`; as it was when there is nothing to trim. */
export function trimImage(src: string, done: (src: string) => void) {
  if (src.startsWith('data:image/svg')) return done(src);
  const img = new Image();
  img.onerror = () => done(src);
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !w || !h) return done(src);
    ctx.drawImage(img, 0, 0);
    const box = contentBox(ctx.getImageData(0, 0, w, h).data, w, h);
    if (!box) return done(src);
    const gap = Math.round(Math.max(box.width, box.height) * GAP);
    const x = Math.max(0, box.left - gap);
    const y = Math.max(0, box.top - gap);
    const cw = Math.min(w, box.left + box.width + gap) - x;
    const ch = Math.min(h, box.top + box.height + gap) - y;
    // Nothing worth trimming: keep the file as it came.
    if (cw >= w - 2 && ch >= h - 2) return done(src);
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    out.getContext('2d')?.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
    done(out.toDataURL('image/png'));
  };
  img.src = src;
}
