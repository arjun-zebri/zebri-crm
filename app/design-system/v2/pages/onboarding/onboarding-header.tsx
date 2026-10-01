import Image from 'next/image';

import { Progress } from './onboarding-rail';

/**
 * Onboarding header, phones only: the Z mark and "Set up Zebri", with
 * the progress bar under it. From `md` the rail carries both, and the
 * "1 / 9" counter sits above each step's title at every width. No close
 * button: setup is not skippable.
 *
 * @module app/design-system/v2/pages/onboarding/onboarding-header
 */
export function OnboardingHeader({ step }: { step: number }) {
  return (
    <header className="shrink-0 space-y-3 border-b border-zebra-200 px-5 py-4 md:hidden">
      <div className="flex items-center gap-2.5">
        {/* The icon SVG has a white square baked in; multiply drops it out. */}
        <Image src="/zebri-icon.svg" alt="" width={28} height={28} className="size-7 mix-blend-multiply" />
        <span className="type-label text-zebra-950">Set up Zebri</span>
      </div>
      <Progress step={step} />
    </header>
  );
}
