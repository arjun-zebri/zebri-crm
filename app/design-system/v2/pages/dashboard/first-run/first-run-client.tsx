'use client';

import dynamic from 'next/dynamic';

import { Backdrop } from '@/components/ui-v2/backdrop';

/**
 * The first-run dashboard, rendered on the client only: it reads the
 * onboarding handoff and the checklist from `localStorage`, which the
 * server cannot see. Same approach as the dashboard and onboarding.
 * While it loads, the backdrop alone: setup fades out over the same one,
 * so the hand-off shows no blank frame.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/first-run-client
 */
export const FirstRunClient = dynamic(() => import('./first-run-page').then((m) => m.FirstRunPage), {
  ssr: false,
  loading: () => (
    <div className="relative isolate h-dvh">
      <Backdrop />
    </div>
  ),
});
