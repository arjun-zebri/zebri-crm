'use client';

import dynamic from 'next/dynamic';

/**
 * The full-screen onboarding, rendered on the client only. It resumes
 * from `localStorage` on its first render, which the server cannot see,
 * so a server render would disagree with the client's and fail to
 * hydrate.
 *
 * @module app/design-system/v2/pages/onboarding/onboarding-client
 */
export const OnboardingClient = dynamic(() => import('./onboarding-flow').then((m) => m.OnboardingFlow), {
  ssr: false,
  loading: () => <div className="h-dvh" />,
});
