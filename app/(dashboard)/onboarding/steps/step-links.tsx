'use client'

import { Facebook, Globe, Instagram } from 'lucide-react'

import { LabelledInput } from './labelled-input'
import type { WelcomeProfile } from './step-details'

/** Props for {@link StepLinks}. */
export interface StepLinksProps {
  value: WelcomeProfile
  onChange: (next: WelcomeProfile) => void
}

/**
 * Step 3: where couples can find you.
 *
 * A single focused column, centred in the modal, matching step 2. Split
 * from step 2 so neither screen becomes a dense nine-field form;
 * advancing from here is what saves both steps.
 */
export function StepLinks({ value, onChange }: StepLinksProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="min-h-full flex flex-col justify-center max-w-xl mx-auto w-full gap-6 py-2">
      <div>
        <h2 className="text-section font-semibold text-text">Where can couples find you?</h2>
        <p className="text-body text-text-muted mt-2">
          All optional. You can add these later in Settings.
        </p>
      </div>

      <div className="space-y-5">
        <LabelledInput
          icon={Globe}
          label="Website"
          value={value.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="https://yoursite.com"
        />
        <LabelledInput
          icon={Instagram}
          label="Instagram"
          value={value.instagramUrl}
          onChange={(e) => set('instagramUrl', e.target.value)}
          placeholder="https://instagram.com/yourhandle"
        />
        <LabelledInput
          icon={Facebook}
          label="Facebook"
          value={value.facebookUrl}
          onChange={(e) => set('facebookUrl', e.target.value)}
          placeholder="https://facebook.com/yourpage"
        />
      </div>
    </div>
  )
}
