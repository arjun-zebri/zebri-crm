'use client';

import dynamic from 'next/dynamic';

/**
 * The canvas editor's playground (dev-only, via the showroom layout).
 * Client-only: the editor measures the window to fit its pages.
 *
 * @module app/design-system/v2/canvas/page
 */
const CanvasPlayground = dynamic(() => import('../pages/dashboard/canvas/canvas-playground').then((m) => m.CanvasPlayground), {
  ssr: false,
  loading: () => <div className="h-dvh" />,
});

export default function CanvasPage() {
  return <CanvasPlayground />;
}
