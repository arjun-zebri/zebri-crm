/**
 * Canvas a person draws their signature on.
 *
 * Pointer events rather than separate mouse and touch handlers, with
 * `setPointerCapture` so a stroke that leaves the canvas mid-gesture still
 * tracks, and `touch-action: none` so dragging draws instead of scrolling the
 * page. Those two are what make it usable with a finger, which is how most
 * couples will sign.
 *
 * Exports a base64 PNG data URL rather than uploading anywhere. See
 * `lib/contracts/signature-image` for the size budget and
 * `supabase/migrations/20260903003000_drawn_signatures.sql` for why a data URL
 * rather than a Storage object.
 *
 * Appearance is injectable because this renders on two very different surfaces:
 * in-app Settings, where it should use Zebri's tokens, and the public contract
 * page, where it must use the MC's brand colours. The defaults cover the
 * in-app case so that caller passes nothing.
 *
 * @example
 * ```tsx
 * <SignaturePad value={dataUrl} onChange={setDataUrl} label="Your signature" />
 * ```
 *
 * @module components/ui/signature-pad
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isEmptyStroke,
  padPixelRatio,
  type Stroke,
  type StrokePoint,
} from '@/lib/contracts/signature-strokes';

/** Colours and metrics for one host surface. */
export interface SignaturePadAppearance {
  /** Ink colour. */
  strokeColor?: string;
  /** Pad border colour. */
  borderColor?: string;
  /** Pad background. */
  backgroundColor?: string;
  /** Corner radius in px. */
  radius?: number;
  /** Colour for the guide line and the Clear control. */
  mutedColor?: string;
}

export interface SignaturePadProps {
  /** Current signature as a PNG data URL, or null when empty. */
  value: string | null;
  /** Called with the new data URL, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  /** Accessible name for the drawing surface. */
  label?: string;
  /** Host-surface colours. Omit in-app to get the token defaults. */
  appearance?: SignaturePadAppearance;
  disabled?: boolean;
}

/** Drawing-surface height, in CSS px. Width tracks the container. */
const PAD_HEIGHT = 160;

/**
 * Total height the pad occupies: the surface plus the Clear row beneath it.
 *
 * Exported so a caller that swaps the pad for something else can reserve the
 * identical height and avoid the dialog resizing as the user switches.
 */
export const SIGNATURE_PAD_TOTAL_HEIGHT = PAD_HEIGHT + 6 + 18;

export function SignaturePad({
  value,
  onChange,
  label = 'Draw your signature',
  appearance,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  const strokeColor = appearance?.strokeColor ?? '#111827';
  const borderColor = appearance?.borderColor ?? '#E5E7EB';
  const backgroundColor = appearance?.backgroundColor ?? 'transparent';
  const mutedColor = appearance?.mutedColor ?? '#9CA3AF';
  const radius = appearance?.radius ?? 6;

  /** Size the backing store to the element, accounting for DPI. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = padPixelRatio(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
    const width = canvas.clientWidth || 480;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(PAD_HEIGHT * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
  }, [strokeColor]);

  useEffect(() => {
    resize();
  }, [resize]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** Re-export the canvas and hand the caller a data URL (or null if empty). */
  const publish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isEmptyStroke(strokesRef.current)) {
      setHasInk(false);
      onChange(null);
      return;
    }
    setHasInk(true);
    onChange(canvas.toDataURL('image/png'));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    // Capture so a stroke that wanders off the canvas keeps tracking rather
    // than ending mid-signature.
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const point = pointFrom(e);
    strokesRef.current.push([point]);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = pointFrom(e);
    strokesRef.current[strokesRef.current.length - 1]?.push(point);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    publish();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div
        className="relative w-full overflow-hidden border"
        style={{ borderColor, backgroundColor, borderRadius: radius, height: PAD_HEIGHT }}
      >
        {/* Guide line, so the pad reads as a place to sign rather than a box. */}
        <div
          className="pointer-events-none absolute inset-x-6 bottom-9 border-b"
          style={{ borderColor: mutedColor, opacity: 0.5 }}
          aria-hidden
        />
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          // `touch-action: none` is what makes a finger draw instead of
          // scrolling the page out from under the signer.
          className="relative block h-full w-full touch-none"
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: mutedColor, fontSize: 13 }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
