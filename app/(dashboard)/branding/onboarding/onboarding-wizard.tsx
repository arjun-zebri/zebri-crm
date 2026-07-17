'use client'

import { useState } from 'react'

import type { BodyFont, HeadingFont } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'
import type { SurfaceTab } from '@/types/branding-preview'

import { StepBusiness } from './step-business'
import { StepDocuments } from './step-documents'
import { StepIndicator } from './step-indicator'
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
  brandColor: string
  /** Secondary brand colour; persisted as secondary_color (supporting buttons). */
  secondaryColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  /** Corner radius in px for cards and buttons. */
  cornerRadius: number
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
 * Three-step wizard: business identity, visual look, document surfaces.
 * Supports skip on every step (uses defaults).
 * Shows progress dots and step navigation.
 *
 * Design: full-page centered column, calm, no boxes-in-boxes.
 * @public
 */
export function OnboardingWizard(props: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // Welcome screen shown before the steps; dismissed by Get started.
  const [intro, setIntro] = useState(true)
  const [businessName, setBusinessName] = useState(props.initial.businessName || '')
  const [tagline, setTagline] = useState(props.initial.tagline || '')
  const [logoUrl, setLogoUrl] = useState(props.initial.logoUrl || '')
  const [brandColor, setBrandColor] = useState(props.initial.brandColor || '#6366F1')
  const [secondaryColor, setSecondaryColor] = useState(props.initial.secondaryColor || '#111827')
  const [fontHeading, setFontHeading] = useState<HeadingFont>(props.initial.fontHeading || 'playfair')
  const [fontBody, setFontBody] = useState<BodyFont>(props.initial.fontBody || 'inter')
  const [density, setDensity] = useState<Density>(props.initial.density || 'cozy')
  const [cornerRadius, setCornerRadius] = useState(props.initial.cornerRadius ?? 8)
  const [enabledSurfaces, setEnabledSurfaces] = useState<SurfaceTab[]>(
    props.initial.enabledSurfaces && props.initial.enabledSurfaces.length > 0
      ? props.initial.enabledSurfaces
      : ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'],
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
      brandColor,
      secondaryColor,
      fontHeading,
      fontBody,
      density,
      cornerRadius,
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
      brandColor: brandColor || props.initial.brandColor || '#6366F1',
      secondaryColor: secondaryColor || props.initial.secondaryColor || '#111827',
      fontHeading: fontHeading || props.initial.fontHeading || 'playfair',
      fontBody: fontBody || props.initial.fontBody || 'inter',
      density: density || props.initial.density || 'cozy',
      cornerRadius,
      enabledSurfaces: ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'],
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
        <div className="mx-6 mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
          {props.error}
        </div>
      )}

      {/* Header: the step rail spans the full modal width. */}
      {!intro && (
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <StepIndicator currentStep={step} />
        </div>
      )}

      {/* Middle: form column left, companion pane right. */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col px-6 py-5">
        {intro && (
          /* Welcome screen: the message comes before the steps. */
          <div className="flex-1 flex flex-col justify-center gap-3 pb-10">
            <h2 className="text-xl font-semibold text-text">Welcome to your branding</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Three quick steps: your business, your look, and which documents
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
            logoUrl={logoUrl}
            brandColor={brandColor}
            setBrandColor={setBrandColor}
            secondaryColor={secondaryColor}
            setSecondaryColor={setSecondaryColor}
            fontHeading={fontHeading}
            setFontHeading={setFontHeading}
            fontBody={fontBody}
            setFontBody={setFontBody}
            density={density}
            setDensity={setDensity}
            cornerRadius={cornerRadius}
            setCornerRadius={setCornerRadius}
          />
        )}

        {step === 3 && (
          <StepDocuments
            enabledSurfaces={enabledSurfaces}
            setEnabledSurfaces={setEnabledSurfaces}
          />
        )}
        </div>
        )}
        </div>

        {/* Right pane: live preview of the choices (hidden on narrow screens). */}
        <div className="hidden sm:block w-[380px] shrink-0 border-l border-border bg-surface-muted p-5">
          <WizardPreview
            businessName={businessName}
            tagline={tagline}
            logoUrl={logoUrl}
            brandColor={brandColor}
            fontHeading={fontHeading}
            fontBody={fontBody}
            density={density}
            secondaryColor={secondaryColor}
            cornerRadius={cornerRadius}
            enabledSurfaces={enabledSurfaces}
            step={step}
            intro={intro}
          />
        </div>
      </div>

      {/* Footer: spans the full modal width. */}
      <div className="px-6 py-4 border-t border-border">
        <WizardChrome
          step={step}
          intro={intro}
          loading={loading}
          onStart={() => setIntro(false)}
          onBack={() => setStep((s) => (s > 1 ? (s - 1 as 1 | 2 | 3) : s))}
          onSkip={handleSkip}
          onNext={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
          onFinish={handleComplete}
          canFinish={enabledSurfaces.length > 0}
        />
      </div>
    </div>
  )
}
