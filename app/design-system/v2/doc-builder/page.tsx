'use client';

import dynamic from 'next/dynamic';

/**
 * The document engine on its own (dev-only, via the showroom layout).
 * Client-only, like the dashboard: the brand kit and the editor read the
 * browser's storage and clock.
 *
 * @module app/design-system/v2/doc-builder/page
 */
const EngineDemo = dynamic(() => import('../pages/dashboard/doc-builder/showroom/engine-demo').then((m) => m.EngineDemo), {
  ssr: false,
  loading: () => <div className="h-dvh" />,
});

export default function DocBuilderPage() {
  return <EngineDemo />;
}
