'use client'

import { useState } from 'react'

import type { BodyFont, HeadingFont } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'
import type { SurfaceTab } from '@/types/branding-preview'

import { StepBusiness } from './step-business'
import { StepDocuments } from './step-documents'
import { StepEditorDemo } from './step-editor-demo'
import { StepLook } from './step-look'
import { WizardChrome } from './wizard-chrome'
import { WizardPreview } from './wizard-preview'

/**
 * Complete onboarding result after all three steps.
 * @public
 */
export interface OnboardingResult {
  businessName: string
  tagline: string
  logoUrl: string
  headingColor: string
  subheadingColor: string
  bodyColor: string
  backgroundColor: string
  primaryButtonColor: string
  secondaryButtonColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  enabledSurfaces: SurfaceTab[]
}

/**
 * Props for the onboarding wizard.
 * @public
 */
export interface OnboardingWizardProps {
  /** Prefill from existing scalar branding (users keep their look). */
  initial: Partial<OnboardingResult>
  /** Called when wizard completes or is skipped; must reload page data after. */
  onComplete: (result: OnboardingResult) => Promise<void>
  /** Error state from parent (e.g., failed auth update); displays inline, wizard stays. */
  error?: string | null
}

/**
 * OnboardingWizard — First-run setup for branding.
 *
 * Four-step wizard: business identity, visual look, document surfaces, and
 * an animated preview of how it all comes together in the editor.
 * Supports skip on every step (uses defaults).
 * Shows progress dots and step navigation.
 *
 * Design: full-page centered column, calm, no boxes-in-boxes.
 * @public
 */
export function OnboardingWizard(props: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // Welcome screen shown before the steps; dismissed by Get started.
  const [intro, setIntro] = useState(true)
  const [businessName, setBusinessName] = useState(props.initial.businessName || '')
  const [tagline, setTagline] = useState(props.initial.tagline || '')
  const [logoUrl, setLogoUrl] = useState(props.initial.logoUrl || '')
  const [headingColor, setHeadingColor] = useState(props.initial.headingColor || '#111827')
  const [subheadingColor, setSubheadingColor] = useState(props.initial.subheadingColor || '#111827')
  const [bodyColor, setBodyColor] = useState(props.initial.bodyColor || '#6B7280')
  const [backgroundColor, setBackgroundColor] = useState(props.initial.backgroundColor || '#FFFFFF')
  const [primaryButtonColor, setPrimaryButtonColor] = useState(props.initial.primaryButtonColor || '#111827')
  const [secondaryButtonColor, setSecondaryButtonColor] = useState(props.initial.secondaryButtonColor || '#6B7280')
  const [fontHeading, setFontHeading] = useState<HeadingFont>(props.initial.fontHeading || 'playfair')
  const [fontBody, setFontBody] = useState<BodyFont>(props.initial.fontBody || 'inter')
  const [density, setDensity] = useState<Density>(props.initial.density || 'cozy')
  const [enabledSurfaces, setEnabledSurfaces] = useState<SurfaceTab[]>(
    props.initial.enabledSurfaces && props.initial.enabledSurfaces.length > 0
      ? props.initial.enabledSurfaces
      : ['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'],
  )
  const [loading, setLoading] = useState(false)

  /**
   * Merge into result object and call onComplete callback.
   * Page will reload and mount the editor with new state.
   */
  const handleComplete = async () => {
    const result: OnboardingResult = {
      businessName,
      tagline,
      logoUrl,
      headingColor,
      subheadingColor,
      bodyColor,
      backgroundColor,
      primaryButtonColor,
      secondaryButtonColor,
      fontHeading,
      fontBody,
      density,
      enabledSurfaces,
    }
    setLoading(true)
    try {
      await props.onComplete(result)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Skip: use initial (or defaults if missing) and enable all six surfaces.
   */
  const handleSkip = async () => {
    const result: OnboardingResult = {
      businessName: businessName || props.initial.businessName || '',
      tagline: tagline || props.initial.tagline || '',
      logoUrl: logoUrl || props.initial.logoUrl || '',
      headingColor: headingColor || props.initial.headingColor || '#111827',
      subheadingColor: subheadingColor || props.initial.subheadingColor || '#111827',
      bodyColor: bodyColor || props.initial.bodyColor || '#6B7280',
      backgroundColor: backgroundColor || props.initial.backgroundColor || '#FFFFFF',
      primaryButtonColor: primaryButtonColor || props.initial.primaryButtonColor || '#111827',
      secondaryButtonColor: secondaryButtonColor || props.initial.secondaryButtonColor || '#6B7280',
      fontHeading: fontHeading || props.initial.fontHeading || 'playfair',
      fontBody: fontBody || props.initial.fontBody || 'inter',
      density: density || props.initial.density || 'cozy',
      enabledSurfaces: ['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'],
    }
    setLoading(true)
    try {
      await props.onComplete(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {props.error && (
        <div className="mx-6 mt-4 p-3 bg-danger/10 border border-danger/20 rounded-control text-body text-danger">
          {props.error}
        </div>
      )}

      {/* Middle: form column left, companion pane right. Step progress lives
          in the footer (bottom left), matching the welcome tour. */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col px-6 py-5">
        {intro && (
          /* Welcome screen: the message comes before the steps. */
          <div className="flex-1 flex flex-col justify-center gap-3 pb-10">
            <h2 className="text-section font-semibold text-text">Welcome to your branding</h2>
            <p className="text-body text-text-muted leading-relaxed">
              A few quick steps: your business, your look, and which documents
              you send. This just gets you going, you can change everything
              later in the editor.
            </p>
          </div>
        )}

        {/* Step content; the card is sized so this never scrolls at normal
            viewport heights, overflow-y-auto is the short-window fallback. */}
        {!intro && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {step === 1 && (
          <StepBusiness
            businessName={businessName}
            setBusinessName={setBusinessName}
            tagline={tagline}
            setTagline={setTagline}
            logoUrl={logoUrl}
            setLogoUrl={setLogoUrl}
          />
        )}

        {step === 2 && (
          <StepLook
            headingColor={headingColor}
            setHeadingColor={setHeadingColor}
            subheadingColor={subheadingColor}
            setSubheadingColor={setSubheadingColor}
            bodyColor={bodyColor}
            setBodyColor={setBodyColor}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            primaryButtonColor={primaryButtonColor}
            setPrimaryButtonColor={setPrimaryButtonColor}
            secondaryButtonColor={secondaryButtonColor}
            setSecondaryButtonColor={setSecondaryButtonColor}
            fontHeading={fontHeading}
            setFontHeading={setFontHeading}
            fontBody={fontBody}
            setFontBody={setFontBody}
            density={density}
            setDensity={setDensity}
          />
        )}

        {step === 3 && (
          <StepDocuments
            enabledSurfaces={enabledSurfaces}
            setEnabledSurfaces={setEnabledSurfaces}
          />
        )}

        {step === 4 && <StepEditorDemo />}
        </div>
        )}
        </div>

        {/* Right pane: live preview of the choices (hidden on narrow screens,
            on the documents step, whose cards carry their own copy, and on
            the editor demo, which wants the full width for its scene). */}
        {(intro || step === 1 || step === 2) && (
        <div className="hidden sm:block w-[380px] shrink-0 border-l border-border bg-surface-muted p-5">
          <WizardPreview
            businessName={businessName}
            tagline={tagline}
            logoUrl={logoUrl}
            headingColor={headingColor}
            subheadingColor={subheadingColor}
            bodyColor={bodyColor}
            backgroundColor={backgroundColor}
            primaryButtonColor={primaryButtonColor}
            secondaryButtonColor={secondaryButtonColor}
            fontHeading={fontHeading}
            fontBody={fontBody}
            density={density}
            step={step}
            intro={intro}
          />
        </div>
        )}
      </div>

      {/* Footer: spans the full modal width. */}
      <div className="px-6 py-4 border-t border-border">
        <WizardChrome
          step={step}
          intro={intro}
          loading={loading}
          onStart={() => setIntro(false)}
          onBack={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
          onSkip={handleSkip}
          onNext={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
          onFinish={handleComplete}
          canFinish={enabledSurfaces.length > 0}
        />
      </div>
    </div>
  )
}
