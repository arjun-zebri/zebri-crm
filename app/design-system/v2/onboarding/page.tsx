import { OnboardingClient } from '../pages/onboarding/onboarding-client';

/**
 * Full-screen v2 onboarding (dev-only, via the showroom layout). Saves
 * progress so a reload resumes where it left off.
 *
 * @module app/design-system/v2/onboarding/page
 */
export default function OnboardingV2Page() {
  return <OnboardingClient storageKey="zebri-v2-onboarding-demo" />;
}
