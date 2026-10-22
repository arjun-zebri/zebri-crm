'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { Panel } from '@/components/ui-v2/panel';

import { FIRST_RUN_PATH, writeHandoff } from '../dashboard/first-run/handoff';

import { OnboardingFooter } from './onboarding-footer';
import { StepAbout } from './step-about';
import { useOnboardingKeys } from './use-onboarding-keys';
import { useOnboardingState, type Brand, type Profile } from './use-onboarding-state';
import { WelcomeScreen } from './welcome-screen';

/**
 * The v2 setup: the welcome cover, then ONE screen (who you are, what
 * you do, your website), then straight into Zebri, where the test client
 * is waiting for a proposal. Journeys are not explained here: a new MC
 * meets one in the practice run, when Zebri sends the test client's
 * contract by itself, and only then is it named (founder, 2026-10-08: a
 * screen describing a journey before they had seen one meant nothing).
 * Everything else the old nine-step setup asked is asked where it is used: prices inside New proposal, the
 * signature inside New contract, the plan and card at the first real
 * client, blocks from the role (changed any time in Blocks). The aha is
 * a real payment in the real app about two minutes after sign up.
 *
 * Not skippable (the name is required). Answers save as they are typed
 * (with `storageKey`); Cmd/Ctrl+Enter continues.
 *
 * @module app/design-system/v2/pages/onboarding/onboarding-flow
 */
export function OnboardingFlow({
  contained = false,
  storageKey,
}: {
  contained?: boolean;
  storageKey?: string;
}) {
  const { state, setState, reset, forget } = useOnboardingState(storageKey);
  const { step, profile } = state;
  const router = useRouter();
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Finishing fades the panel away over the backdrop the dashboard shares, so the hand-off never cuts.
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const setProfile = (p: Partial<Profile>) =>
    setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  const setBrand = (b: Partial<Brand>) => setState((s) => ({ ...s, brand: { ...s.brand, ...b } }));
  function next() {
    if (busy) return;
    if (step === 0) return setState((s) => ({ ...s, step: 1 }));
    if (!profile.name.trim())
      return setNameError('Add your name so clients know who they are talking to.');
    setNameError(undefined);
    setBusy(true);
    window.setTimeout(() => {
      // The showroom preview has no storage key: it starts over in place.
      if (!storageKey) {
        setBusy(false);
        return reset();
      }
      // Stays as it is, button spinning, until the dashboard replaces it:
      // resetting here showed the cover for a beat before the route landed.
      writeHandoff(state);
      forget();
      setLeaving(true);
      window.setTimeout(() => router.push(FIRST_RUN_PATH), 260);
    }, 700);
  }
  useOnboardingKeys(panel, step, next);

  return (
    // Framed as AuthShell frames log in and sign up (same padding, same
    // raised panel), so the three read as one flow.
    <div
      className={`relative isolate flex items-center justify-center p-4 sm:p-6 ${contained ? 'h-[56rem] overflow-hidden rounded-panel' : 'h-dvh'}`}
    >
      <Backdrop contained={contained} />
      <Panel
        ref={panel}
        as="section"
        raised
        aria-label="Set up Zebri"
        className={`flex h-full max-h-[52rem] w-full max-w-5xl flex-col overflow-hidden ${leaving ? 'motion-safe:animate-[swap-out_280ms_var(--ease-roll)_both] motion-reduce:opacity-0' : ''}`}
      >
        {step === 0 ? (
          <div data-step={0} className="min-h-0 flex-1 overflow-y-auto">
            <WelcomeScreen onStart={next} contained={contained} />
          </div>
        ) : (
          <div data-step={step} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-8 sm:px-10 motion-safe:animate-[step-in_280ms_ease-out_both] [--step-from:12px]">
                <StepAbout profile={profile} onProfile={setProfile} onBrand={setBrand} nameError={nameError} contained={contained} />
              </div>
            </div>
            <OnboardingFooter isFirst isLast busy={busy} status="" onBack={() => {}} onNext={next} />
          </div>
        )}
      </Panel>
    </div>
  );
}
