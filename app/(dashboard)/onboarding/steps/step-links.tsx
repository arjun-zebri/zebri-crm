'use client'

import { Input } from '@/components/ui/input'

import type { WelcomeProfile } from './step-details'

/** Props for {@link StepLinks}. */
export interface StepLinksProps {
  value: WelcomeProfile
  onChange: (next: WelcomeProfile) => void
}

/**
 * Step 3: where couples can find you.
 *
 * Split from step 2 so neither screen becomes a dense nine-field form.
 * Advancing from here is what saves both steps.
 */
export function StepLinks({ value, onChange }: StepLinksProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">Where can couples find you?</h2>
        <p className="text-sm text-text-muted mt-1">
          All optional. You can add these later in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Website"
          value={value.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="https://yoursite.com"
        />
        <Input
          label="Instagram"
          value={value.instagramUrl}
          onChange={(e) => set('instagramUrl', e.target.value)}
          placeholder="https://instagram.com/yourhandle"
        />
        <Input
          label="Facebook"
          value={value.facebookUrl}
          onChange={(e) => set('facebookUrl', e.target.value)}
          placeholder="https://facebook.com/yourpage"
        />
      </div>
    </div>
  )
}
