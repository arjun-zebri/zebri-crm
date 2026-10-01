'use client';

import dynamic from 'next/dynamic';

/**
 * The v2 dashboard, rendered on the client only. The greeting, the brief
 * and the event countdown come from the viewer's clock, which the
 * server cannot see, so a server render would disagree with the client's
 * and fail to hydrate. Same approach as the onboarding preview.
 *
 * @module app/design-system/v2/pages/dashboard/dashboard-client
 */
export const DashboardClient = dynamic(() => import('./dashboard-page').then((m) => m.DashboardPageV2), {
  ssr: false,
  loading: () => <div className="h-dvh" />,
});
