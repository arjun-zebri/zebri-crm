'use client'

import { Building2, Mail, PenLine, Phone, User } from 'lucide-react'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'

import { LabelledInput } from './labelled-input'

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
 * A single focused column, centred in the modal. Name and business name
 * arrive prefilled from signup and stay editable, because business name
 * appears on every invoice and contract and a typo made at signup should
 * be fixable here. Email is read-only: changing it needs Supabase's
 * confirmation round-trip, so an editable field would appear to work and
 * then quietly not take effect — the info glyph beside the label explains
 * this on hover.
 */
export function StepDetails({ value, email, onChange }: StepFormProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="min-h-full flex flex-col justify-center max-w-xl mx-auto w-full gap-6 py-2">
      <div>
        <h2 className="text-xl font-semibold text-text">Tell us about you</h2>
        <p className="text-sm text-text-muted mt-2">
          This appears on the invoices and contracts you send.
          Your home address is used to calculate the distance to each event.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        <LabelledInput
          icon={User}
          label="Your name"
          value={value.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="Your full name"
        />
        <LabelledInput
          icon={Mail}
          label="Email"
          value={email}
          readOnly
          tooltip="This is your sign-in email, so it can't be edited here."
        />
        <LabelledInput
          icon={Building2}
          label="Business name"
          value={value.businessName}
          onChange={(e) => set('businessName', e.target.value)}
          placeholder="Your MC business name"
        />
        <LabelledInput
          icon={Phone}
          label="Phone"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+61 400 000 000"
        />
        <div className="sm:col-span-2">
          <LabelledInput
            icon={PenLine}
            label="Signature name"
            value={value.mcSignatureName}
            onChange={(e) => set('mcSignatureName', e.target.value)}
            placeholder="Your full legal name"
            help="Used when you sign contracts."
          />
        </div>
        <div className="sm:col-span-2">
          <AddressAutocomplete
            value={value.addressText}
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
