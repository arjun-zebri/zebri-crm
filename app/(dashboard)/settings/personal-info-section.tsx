'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useToast } from '@/components/ui/toast'

const businessTypeOptions = [
  { value: 'mc', label: 'MC' },
  { value: 'celebrant', label: 'Celebrant' },
]

interface PersonalInfoSectionProps {
  initialData: {
    displayName: string
    businessName: string
    phone: string
    website: string
    instagramUrl: string
    facebookUrl: string
    businessType: string
    mcSignatureName: string
  }
  email: string
}

export function PersonalInfoSection({ initialData, email }: PersonalInfoSectionProps) {
  const [displayName, setDisplayName] = useState(initialData.displayName)
  const [emailValue, setEmailValue] = useState(email)
  const [businessName, setBusinessName] = useState(initialData.businessName)
  const [website, setWebsite] = useState(initialData.website)
  const [phone, setPhone] = useState(initialData.phone)
  const [instagramUrl, setInstagramUrl] = useState(initialData.instagramUrl)
  const [facebookUrl, setFacebookUrl] = useState(initialData.facebookUrl)
  const [businessType, setBusinessType] = useState(initialData.businessType)
  const [businessTypeOpen, setBusinessTypeOpen] = useState(false)
  const [mcSignatureName, setMcSignatureName] = useState(initialData.mcSignatureName)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const isDirty =
    displayName !== initialData.displayName ||
    emailValue !== email ||
    businessName !== initialData.businessName ||
    phone !== initialData.phone ||
    website !== initialData.website ||
    instagramUrl !== initialData.instagramUrl ||
    facebookUrl !== initialData.facebookUrl ||
    businessType !== initialData.businessType ||
    mcSignatureName !== initialData.mcSignatureName

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data.', 'error')
      setLoading(false)
      return
    }

    const existingMetadata = user.user_metadata || {}
    const updatedMetadata = {
      ...existingMetadata,
      display_name: displayName,
      business_name: businessName,
      phone,
      website,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      business_type: businessType,
      mc_signature_name: mcSignatureName,
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: updatedMetadata,
    })

    if (metaError) {
      toast(metaError.message, 'error')
      setLoading(false)
      return
    }

    if (emailValue !== email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: emailValue })
      if (emailError) {
        toast(emailError.message, 'error')
        setLoading(false)
        return
      }
      toast('Profile updated. A confirmation link will be sent to your new email.')
    } else {
      toast('Profile updated.')
    }

    setLoading(false)
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  const selectedLabel = businessTypeOptions.find((o) => o.value === businessType)?.label

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Personal info</h2>
      <p className="text-sm text-gray-500 mb-5">Update your name, contact details, and business information.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={inputClass}
              placeholder="Your MC business name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <Popover.Root open={businessTypeOpen} onOpenChange={setBusinessTypeOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left cursor-pointer`}
                >
                  <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedLabel || 'Select type'}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                  align="start"
                >
                  {businessTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setBusinessType(option.value)
                        setBusinessTypeOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition cursor-pointer ${
                        businessType === option.value
                          ? 'bg-green-50 text-green-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputClass}
              placeholder="https://yoursite.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+61 400 000 000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className={inputClass}
              placeholder="https://instagram.com/yourhandle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              className={inputClass}
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Signature name</label>
            <input
              type="text"
              value={mcSignatureName}
              onChange={(e) => setMcSignatureName(e.target.value)}
              className={inputClass}
              placeholder="Your full legal name"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Used as your typed signature on contracts you send.
            </p>
            {mcSignatureName && (
              <div className="mt-2 border border-gray-100 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Preview</p>
                <p className="text-2xl text-gray-900" style={{ fontFamily: 'Caveat, "Brush Script MT", cursive' }}>
                  {mcSignatureName}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !isDirty}
            className="bg-black text-white text-sm font-medium rounded-xl px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>

          {isDirty && (
            <span className="text-sm text-gray-400">Unsaved changes</span>
          )}
        </div>
      </form>
    </div>
  )
}
