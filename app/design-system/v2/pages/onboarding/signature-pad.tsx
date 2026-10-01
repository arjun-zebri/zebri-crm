'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui-v2/button';

/**
 * A canvas to draw a signature on with a trackpad, mouse or finger.
 * Pointer events cover all three; `touch-none` stops a finger stroke
 * from scrolling the page instead of drawing. Each finished stroke
 * reports the drawing as a PNG data URL (null once cleared), so later
 * steps can show the MC's real signature. The PNG is cropped to the ink
 * (see {@link trimmed}), so it fills a signature line wherever it lands.
 *
 * @module app/design-system/v2/pages/onboarding/signature-pad
 */

/**
 * The drawing cropped to its strokes, with a small margin. Uncropped, the
 * PNG is mostly empty canvas, and a signature fitted to a contract's
 * signature line shrank to a squiggle.
 */
function trimmed(c: HTMLCanvasElement): string {
  const g = c.getContext('2d');
  if (!g || !c.width || !c.height) return c.toDataURL('image/png');
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let top = c.height, left = c.width, bottom = -1, right = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if ((data[(y * c.width + x) * 4 + 3] ?? 0) > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
  if (bottom < 0) return c.toDataURL('image/png');
  const pad = 8;
  const x0 = Math.max(0, left - pad), y0 = Math.max(0, top - pad);
  const w = Math.min(c.width, right + pad + 1) - x0, h = Math.min(c.height, bottom + pad + 1) - y0;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}
export function SignaturePad({ onDraw }: { onDraw?: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function ctx() {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return null;
    // Match the backing store to the displayed size (and pixel ratio),
    // or strokes land offset and blurry.
    const ratio = window.devicePixelRatio || 1;
    if (c.width !== c.clientWidth * ratio) {
      c.width = c.clientWidth * ratio;
      c.height = c.clientHeight * ratio;
      g.scale(ratio, ratio);
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = '#0b0b0a';
    }
    return g;
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <p className="type-label text-zebra-950">Draw your signature</p>
        <Button
          variant="ghost"
          onClick={() => {
            ctx()?.clearRect(0, 0, 9999, 9999);
            onDraw?.(null);
          }}
        >
          Clear
        </Button>
      </div>
      <canvas
        ref={canvas}
        aria-label="Signature drawing area"
        className="block h-40 w-full cursor-crosshair touch-none rounded-panel border border-zebra-200 bg-field"
        onPointerDown={(e) => {
          const g = ctx();
          if (!g) return;
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          g.beginPath();
          g.moveTo(...point(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = ctx();
          g?.lineTo(...point(e));
          g?.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          onDraw?.(trimmed(e.currentTarget));
        }}
      />
      <p className="type-body text-zebra-500">Sign here with a trackpad, mouse or finger.</p>
    </div>
  );
}
