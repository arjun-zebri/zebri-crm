'use client'

import { useState } from 'react'

import { StepDetails, type WelcomeProfile } from './steps/step-details'
import { StepFounder } from './steps/step-founder'
import { StepLinks } from './steps/step-links'
import { StepWelcome } from './steps/step-welcome'
import { WizardChrome, TOTAL_STEPS, type WelcomeStep } from './wizard-chrome'

/** Result of persisting the profile. */
export type SaveResult = { ok: true } | { ok: false; message: string }

/** Props for {@link WelcomeWizard}. */
export interface WelcomeWizardProps {
  initial: WelcomeProfile
  email: string
  /** Called once, when the user leaves step 3 going forward. */
  onSaveProfile: (profile: WelcomeProfile) => Promise<SaveResult>
  /** Called when the user finishes the last step. */
  onExit: () => void
}

/**
 * The eight-step welcome wizard.
 *
 * The save happens on the way out of step 3 rather than at Finish. The two
 * halves of this flow have different drop-off profiles: someone who fills
 * in their details and then meets four screens of animation may well close
 * at step 4, and they should keep what they typed.
 */
export function WelcomeWizard({ initial, email, onSaveProfile, onExit }: WelcomeWizardProps) {
  const [step, setStep] = useState<WelcomeStep>(1)
  const [profile, setProfile] = useState<WelcomeProfile>(initial)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const goTo = (next: WelcomeStep) => setStep(next)

  const handleNext = async () => {
    // Leaving step 3 forward is the single save point. `saved` guards the
    // Back-then-Next path so a second pass does not write again.
    if (step === 3 && !saved) {
      setSaving(true)
      setSaveError(null)
      const result = await onSaveProfile(profile)
      setSaving(false)
      if (result.ok) {
        setSaved(true)
      } else {
        // A failed write never blocks the flow. These fields are optional
        // and all of them remain editable in Settings.
        setSaveError(result.message)
      }
    }
    goTo(Math.min(step + 1, TOTAL_STEPS) as WelcomeStep)
  }

  const handleBack = () => goTo(Math.max(step - 1, 1) as WelcomeStep)
  const handleSkip = () => goTo((step === 2 ? 3 : 4) as WelcomeStep)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepDetails value={profile} email={email} onChange={setProfile} />}
        {step === 3 && <StepLinks value={profile} onChange={setProfile} />}
        {step >= 4 && step <= 7 && (
          <div data-testid="preview-slot" className="h-full" />
        )}
        {step === 8 && <StepFounder />}

        {saveError && (
          <p className="mt-4 text-sm text-text-muted">
            We could not save your details just now ({saveError}). You can add
            them any time in Settings.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4 mt-2">
        <WizardChrome
          step={step}
          saving={saving}
          onBack={handleBack}
          onSkip={handleSkip}
          onNext={() => void handleNext()}
          onFinish={onExit}
        />
      </div>
    </div>
  )
}
