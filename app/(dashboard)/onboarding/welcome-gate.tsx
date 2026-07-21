'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import type { WelcomeProfile } from './steps/step-details'
import { WelcomeModal, WELCOME_CACHE_KEY } from './welcome-modal'
import type { SaveResult } from './welcome-wizard'

function toProfile(user: User): WelcomeProfile {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>
  const str = (key: string) => (typeof m[key] === 'string' ? (m[key] as string) : '')
  const num = (key: string) => (typeof m[key] === 'number' ? (m[key] as number) : null)
  return {
    displayName: str('display_name'),
    businessName: str('business_name'),
    phone: str('phone'),
    addressText: str('address_text'),
    addressLat: num('address_lat'),
    addressLng: num('address_lng'),
    mcSignatureName: str('mc_signature_name'),
    website: str('website'),
    instagramUrl: str('instagram_url'),
    facebookUrl: str('facebook_url'),
  }
}

/**
 * Decides whether the welcome wizard appears.
 *
 * The flag lives in `user_metadata` rather than a table: it rides in the
 * JWT, so the gate costs no query and no migration. It is not an
 * entitlement, so the app_metadata rule in authentication.md does not
 * apply. A user who cleared it would simply see the wizard again.
 */
export function WelcomeGate() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // The localStorage hint suppresses the modal synchronously for the
    // common case (already onboarded), so it cannot flash during the
    // getUser round-trip.
    if (localStorage.getItem(WELCOME_CACHE_KEY) === 'true') return
    let cancelled = false
    void (async () => {
      const { data } = await createClient().auth.getUser()
      if (cancelled || !data.user) return
      const done = Boolean((data.user.user_metadata ?? {}).welcome_onboarded_at)
      if (done) {
        localStorage.setItem(WELCOME_CACHE_KEY, 'true')
        return
      }
      setUser(data.user)
      setOpen(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!user) return null

  const saveProfile = async (profile: WelcomeProfile): Promise<SaveResult> => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        display_name: profile.displayName,
        business_name: profile.businessName,
        phone: profile.phone,
        website: profile.website,
        instagram_url: profile.instagramUrl,
        facebook_url: profile.facebookUrl,
        mc_signature_name: profile.mcSignatureName,
        address_text: profile.addressText,
        address_lat: profile.addressLat,
        address_lng: profile.addressLng,
      },
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  }

  const dismiss = () => {
    setOpen(false)
    // Stamp locally first so the modal cannot reappear on the next route
    // change even if the write is slow or fails.
    localStorage.setItem(WELCOME_CACHE_KEY, 'true')
    void createClient().auth.updateUser({
      data: { ...(user.user_metadata ?? {}), welcome_onboarded_at: new Date().toISOString() },
    })
  }

  return (
    <WelcomeModal
      isOpen={open}
      initial={toProfile(user)}
      email={user.email ?? ''}
      onSaveProfile={saveProfile}
      onDismiss={dismiss}
    />
  )
}
