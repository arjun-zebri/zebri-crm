'use client'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { Input } from '@/components/ui/input'

/** Every profile field the welcome wizard can write. */
export interface WelcomeProfile {
  displayName: string
  businessName: string
  phone: string
  addressText: string
  addressLat: number | null
  addressLng: number | null
  mcSignatureName: string
  website: string
  instagramUrl: string
  facebookUrl: string
}

/** Props shared by the two form steps. */
export interface StepFormProps {
  value: WelcomeProfile
  /** The auth email. Read-only here, changed in Settings. */
  email: string
  onChange: (next: WelcomeProfile) => void
}

/**
 * Step 2: identity.
 *
 * Name and business name arrive prefilled from signup and stay editable,
 * because business name appears on every proposal and invoice and a typo
 * made at signup should be fixable here. Email is read-only: changing it
 * needs Supabase's confirmation round-trip, so an editable field would
 * appear to work and then quietly not take effect.
 */
export function StepDetails({ value, email, onChange }: StepFormProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">Tell us about you</h2>
        <p className="text-sm text-text-muted mt-1">
          This appears on the proposals, invoices and contracts you send.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Your name"
          value={value.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="Your full name"
        />
        <Input label="Email" value={email} readOnly help="Change this in Settings." />
        <Input
          label="Business name"
          value={value.businessName}
          onChange={(e) => set('businessName', e.target.value)}
          placeholder="Your MC business name"
        />
        <Input
          label="Phone"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+61 400 000 000"
        />
        <Input
          label="Signature name"
          value={value.mcSignatureName}
          onChange={(e) => set('mcSignatureName', e.target.value)}
          placeholder="Your full legal name"
          help="Used when you sign contracts."
        />
        <div className="sm:col-span-2">
          <AddressAutocomplete
            value={value.addressText}
            help="Used to calculate drive time to each event."
            onChange={(next: AddressValue) =>
              onChange({ ...value, addressText: next.text, addressLat: next.lat, addressLng: next.lng })
            }
            onSelect={(next: AddressValue) =>
              onChange({ ...value, addressText: next.text, addressLat: next.lat, addressLng: next.lng })
            }
          />
        </div>
      </div>
    </div>
  )
}
