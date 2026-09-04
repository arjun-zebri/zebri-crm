'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Info } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { useToast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/tooltip'
import { SIGNATURE_FONT_STACK } from '@/lib/branding/signature-font'
import {
  VENDOR_ROLE_PRESETS,
  derivedVendorRole,
  parseBusinessTypes,
} from '@/lib/branding/vendor-role'
import { createClient } from '@/lib/supabase/client'

import { AutoSaveStatus, type SaveState } from './auto-save-status'
import { SignatureDrawField } from './signature-draw-field'

const businessTypeOptions = VENDOR_ROLE_PRESETS

interface PersonalInfoSectionProps {
  initialData: {
    displayName: string
    businessName: string
    phone: string
    website: string
    googleReviewUrl: string
    instagramUrl: string
    facebookUrl: string
    twitterUrl: string
    pinterestUrl: string
    businessType: string | string[]
    vendorRole: string
    mcSignatureName: string
    /** The MC's drawn signature (PNG data URL) from user_public_settings. */
    mcSignatureImage?: string | null
    addressText: string
    addressLat: number | null
    addressLng: number | null
  }
  email: string
}

export function PersonalInfoSection({ initialData, email }: PersonalInfoSectionProps) {
  const [displayName, setDisplayName] = useState(initialData.displayName)
  const [emailValue, setEmailValue] = useState(email)
  const [businessName, setBusinessName] = useState(initialData.businessName)
  const [website, setWebsite] = useState(initialData.website)
  const [googleReviewUrl, setGoogleReviewUrl] = useState(initialData.googleReviewUrl)
  const [phone, setPhone] = useState(initialData.phone)
  const [instagramUrl, setInstagramUrl] = useState(initialData.instagramUrl)
  const [facebookUrl, setFacebookUrl] = useState(initialData.facebookUrl)
  const [twitterUrl, setTwitterUrl] = useState(initialData.twitterUrl)
  const [pinterestUrl, setPinterestUrl] = useState(initialData.pinterestUrl)
  const [businessTypes, setBusinessTypes] = useState<string[]>(parseBusinessTypes(initialData.businessType))
  const [businessTypeOpen, setBusinessTypeOpen] = useState(false)
  const [vendorRole, setVendorRole] = useState(initialData.vendorRole)
  const [mcSignatureName, setMcSignatureName] = useState(initialData.mcSignatureName)
  const [addressText, setAddressText] = useState(initialData.addressText)
  const [addressLat, setAddressLat] = useState<number | null>(initialData.addressLat)
  const [addressLng, setAddressLng] = useState<number | null>(initialData.addressLng)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // Bumping this requests a save *after* the next render, used by the
  // programmatic changes (business-type picker, address selection) so
  // `autoSave` reads the freshly-committed state, not a stale closure.
  const [saveSignal, setSaveSignal] = useState(0)
  const { toast } = useToast()

  // Last-persisted baseline. Auto-save compares the live fields against
  // this (not the immutable initial props) so a successful save resets
  // "dirty" without remounting, and a blur with no real change is a
  // no-op. `savedRef` mirrors it for the async closure.
  const initialBusinessTypes = parseBusinessTypes(initialData.businessType)
  const savedRef = useRef({
    displayName: initialData.displayName,
    email,
    businessName: initialData.businessName,
    phone: initialData.phone,
    website: initialData.website,
    googleReviewUrl: initialData.googleReviewUrl,
    instagramUrl: initialData.instagramUrl,
    facebookUrl: initialData.facebookUrl,
    twitterUrl: initialData.twitterUrl,
    pinterestUrl: initialData.pinterestUrl,
    businessTypes: initialBusinessTypes,
    vendorRole: initialData.vendorRole,
    mcSignatureName: initialData.mcSignatureName,
    addressText: initialData.addressText,
    addressLat: initialData.addressLat,
    addressLng: initialData.addressLng,
  })

  const isDirty = () => {
    const s = savedRef.current
    return (
      displayName !== s.displayName ||
      emailValue !== s.email ||
      businessName !== s.businessName ||
      phone !== s.phone ||
      website !== s.website ||
      googleReviewUrl !== s.googleReviewUrl ||
      instagramUrl !== s.instagramUrl ||
      facebookUrl !== s.facebookUrl ||
      twitterUrl !== s.twitterUrl ||
      pinterestUrl !== s.pinterestUrl ||
      JSON.stringify([...businessTypes].sort()) !== JSON.stringify([...s.businessTypes].sort()) ||
      vendorRole !== s.vendorRole ||
      mcSignatureName !== s.mcSignatureName ||
      addressText !== s.addressText ||
      addressLat !== s.addressLat ||
      addressLng !== s.addressLng
    )
  }

  // Persist on blur / selection change. No-op when nothing changed
  // since the last save, and skipped while a save is already running so
  // overlapping blurs don't double-fire. Errors surface via toast +
  // the inline status; success is silent beyond the "Saved" hint
  // (a toast on every blur would be noisy).
  // `pendingRef` covers the address-autocomplete race: picking a
  // suggestion blurs the input (kicking off a save) and then resolves
  // lat/lng a moment later. If a save is already running, we mark a
  // re-run so the freshly-set coordinates still persist.
  const savingRef = useRef(false)
  const pendingRef = useRef(false)
  const autoSave = async () => {
    if (!isDirty()) return
    if (savingRef.current) {
      pendingRef.current = true
      return
    }
    savingRef.current = true
    setSaveState('saving')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data.', 'error')
      setSaveState('error')
      savingRef.current = false
      return
    }

    const emailChanged = emailValue !== savedRef.current.email
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata || {}),
        display_name: displayName,
        business_name: businessName,
        phone,
        website,
        google_review_url: googleReviewUrl,
        instagram_url: instagramUrl,
        facebook_url: facebookUrl,
        twitter_url: twitterUrl,
        pinterest_url: pinterestUrl,
        business_type: businessTypes,
        vendor_role: vendorRole,
        mc_signature_name: mcSignatureName,
        address_text: addressText,
        address_lat: addressLat,
        address_lng: addressLng,
      },
    })

    if (metaError) {
      toast(metaError.message, 'error')
      setSaveState('error')
      savingRef.current = false
      return
    }

    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({ email: emailValue })
      if (emailError) {
        toast(emailError.message, 'error')
        setSaveState('error')
        savingRef.current = false
        return
      }
      // Email is the one change worth a toast, it isn't live until the
      // confirmation link is clicked.
      toast('A confirmation link will be sent to your new email.')
    }

    savedRef.current = {
      displayName,
      email: emailValue,
      businessName,
      phone,
      website,
      googleReviewUrl,
      instagramUrl,
      facebookUrl,
      twitterUrl,
      pinterestUrl,
      businessTypes,
      vendorRole,
      mcSignatureName,
      addressText,
      addressLat,
      addressLng,
    }
    setSaveState('saved')
    savingRef.current = false
    if (pendingRef.current) {
      pendingRef.current = false
      void autoSave()
    }
  }

  // Run a requested save once the triggering state has committed.
  // `autoSave` is intentionally excluded from deps, it's re-created
  // every render and we only want to fire on an explicit signal bump.
  useEffect(() => {
    if (saveSignal > 0) void autoSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  const inputClass =
    'w-full border border-border rounded-control px-3 py-2 text-body text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  // Placeholder shows what Business Type alone would produce, so the field
  // reads as an override rather than a required entry.
  const derivedRole = derivedVendorRole({ business_type: businessTypes })
  const placeholderRole = derivedRole.charAt(0).toUpperCase() + derivedRole.slice(1)
  // Explain the field first, then show the sentence it lands in, built from
  // this account's real business name and role. An example on its own does not
  // tell you what the field is for, and the fallback behaviour is not
  // guessable from an empty box.
  const effectiveRole = vendorRole.trim() || derivedRole
  const roleExample =
    "The word clients see you called, on contracts and in their portal. " +
    'Leave blank to follow Business Type.\n\n' +
    `Example: "This agreement is made between ${businessName.trim() || 'your business'} ` +
    `(the ${effectiveRole}) and the Couple."`

  const selectedLabel = businessTypeOptions
    .filter((o) => businessTypes.includes(o.value))
    .map((o) => o.label)
    .join(', ')

  return (
    <div>
      <h2 className="text-section font-semibold text-text mb-1">Personal info</h2>
      <p className="text-body text-text-muted mb-5">Update your name, contact details, and business information. Changes save automatically.</p>
      {/* Auto-save on blur: `onBlur` on the form catches the bubbled
          focusout of any field within it, so leaving a field persists
          it. `autoSave` no-ops when nothing changed. */}
      <form onBlur={autoSave} onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={inputClass}
              placeholder="Your business name"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Business Type</label>
            <Popover.Root
              open={businessTypeOpen}
              onOpenChange={(open) => {
                setBusinessTypeOpen(open)
                // Persist the multi-select once the picker closes.
                if (!open) setSaveSignal((n) => n + 1)
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left cursor-pointer`}
                >
                  <span className={selectedLabel ? 'text-text' : 'text-text-subtle'}>
                    {selectedLabel || 'Select types'}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-surface border border-border rounded-control shadow-lg py-1 z-[90] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                  align="start"
                >
                  {businessTypeOptions.map((option) => {
                    const checked = businessTypes.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setBusinessTypes((prev) =>
                            checked ? prev.filter((v) => v !== option.value) : [...prev, option.value]
                          )
                        }}
                        className={`w-full text-left px-3 py-2 text-body transition cursor-pointer flex items-center gap-2 ${
                          checked ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-control border flex items-center justify-center shrink-0 ${checked ? 'bg-green-600 border-green-600' : 'border-border-strong'}`}>
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        {option.label}
                      </button>
                    )
                  })}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="sm:col-span-2">
            <AddressAutocomplete
              value={addressText}
              tooltip="Used to calculate drive time to each event."
              onChange={(next: AddressValue) => {
                setAddressText(next.text)
                setAddressLat(next.lat)
                setAddressLng(next.lng)
              }}
              onSelect={(next: AddressValue) => {
                setAddressText(next.text)
                setAddressLat(next.lat)
                setAddressLng(next.lng)
                // Persist after this render commits so autoSave reads the
                // freshly-set coordinates rather than a stale closure.
                setSaveSignal((n) => n + 1)
              }}
            />
          </div>

          <div>
            {/* Backs the `{{vendor_role}}` contract variable and the wording on
                every client-facing surface ("Signed by your DJ"). Left blank it
                follows Business Type; typed it wins, for anyone whose title
                isn't one of the three presets. */}
            <div className="flex items-center gap-1.5 mb-1">
              <label className="block text-body font-medium text-gray-700">
                What clients call you
              </label>
              <Tooltip
                // A worked example, not an abstract description: the field is
                // meaningless until you see the sentence it lands in.
                label={roleExample}
                side="top"
                multiline
              >
                <Info
                  size={12}
                  strokeWidth={1.5}
                  className="text-text-subtle cursor-help"
                  aria-hidden
                />
              </Tooltip>
            </div>
            <input
              type="text"
              value={vendorRole}
              onChange={(e) => setVendorRole(e.target.value)}
              className={inputClass}
              placeholder={placeholderRole}
              maxLength={40}
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputClass}
              placeholder="https://yoursite.com"
            />
          </div>

          <div>
            {/* Backs the `{{mc.review_link}}` variable, so the
                review-request automation can link somewhere real
                instead of shipping a placeholder URL. */}
            <label className="block text-body font-medium text-gray-700 mb-1">
              Google review link
            </label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              className={inputClass}
              placeholder="https://g.page/r/…/review"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+61 400 000 000"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Instagram</label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className={inputClass}
              placeholder="https://instagram.com/yourhandle"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Facebook</label>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              className={inputClass}
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Twitter</label>
            <input
              type="url"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className={inputClass}
              placeholder="https://twitter.com/yourhandle"
            />
          </div>

          <div>
            <label className="block text-body font-medium text-gray-700 mb-1">Pinterest</label>
            <input
              type="url"
              value={pinterestUrl}
              onChange={(e) => setPinterestUrl(e.target.value)}
              className={inputClass}
              placeholder="https://pinterest.com/yourprofile"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center gap-1.5 mb-1">
              <label className="block text-body font-medium text-gray-700">Signature name</label>
              <Tooltip label="Used as your typed signature on contracts you send." side="top">
                <Info
                  size={12}
                  strokeWidth={1.5}
                  className="text-text-subtle cursor-help"
                  aria-hidden
                />
              </Tooltip>
            </div>
            <input
              type="text"
              value={mcSignatureName}
              onChange={(e) => setMcSignatureName(e.target.value)}
              className={inputClass}
              placeholder="Your full legal name"
            />
            {mcSignatureName && (
              <div className="mt-2 border border-gray-100 bg-gray-50 rounded-control p-3">
                <p className="text-body text-text-muted mb-1">Preview</p>
                <p className="text-2xl text-text" style={{ fontFamily: SIGNATURE_FONT_STACK }}>
                  {mcSignatureName}
                </p>
              </div>
            )}
          </div>

          {/* The drawn signature sits beside the typed name rather than
              replacing it: the typed name identifies the supplier and is the
              fallback for anyone who has not drawn one. */}
          <SignatureDrawField value={initialData.mcSignatureImage ?? null} />
        </div>

        <div className="flex items-center gap-3 pt-2 h-5">
          <AutoSaveStatus state={saveState} />
        </div>
      </form>
    </div>
  )
}
