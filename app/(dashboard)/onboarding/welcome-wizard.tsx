'use client'

import { useState } from 'react'

import { StepDetails, type WelcomeProfile } from './steps/step-details'
import { StepFounder } from './steps/step-founder'
import { StepLinks } from './steps/step-links'
import { StepPreview } from './steps/step-preview'
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
  // Skip is an exit, not a fast-forward: it closes the whole tour (and the
  // dismiss path stamps the gate, so it does not reopen).
  const handleSkip = () => onExit()

  // Preview and bookend steps own their full height (the frame stretches to
  // the footer); the two form steps stay scrollable for short viewports.
  const fills = step === 1 || (step >= 4 && step <= 8)

  return (
    <div className="flex flex-col h-full">
      <div className={`flex-1 min-h-0 px-1 ${fills ? 'overflow-hidden' : 'overflow-y-auto py-1'}`}>
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepDetails value={profile} email={email} onChange={setProfile} />}
        {step === 3 && <StepLinks value={profile} onChange={setProfile} />}
        {step >= 4 && step <= 7 && (
          <StepPreview step={step as 4 | 5 | 6 | 7} active />
        )}
        {step === 8 && <StepFounder />}
      </div>

      {/* Pinned above the footer so the fill steps' overflow-hidden frame
          can never clip it. */}
      {saveError && (
        <p className="px-1 pt-2 text-body text-text-muted">
          We could not save your details just now ({saveError}). You can add
          them any time in Settings.
        </p>
      )}

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
