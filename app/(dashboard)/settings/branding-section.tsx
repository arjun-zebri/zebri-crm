'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { HelpCircle } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { BrandingPreview } from './branding-preview'

function getTextColor(hex: string): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return '#ffffff'
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

interface BrandingSectionProps {
  initialData: {
    logoUrl: string
    brandColor: string
    tagline: string
    abn: string
    showContactOnDocuments: boolean
    businessName: string
    phone: string
    website: string
    instagramUrl: string
    facebookUrl: string
  }
}

export function BrandingSection({ initialData }: BrandingSectionProps) {
  const [logoUrl, setLogoUrl] = useState(initialData.logoUrl)
  const [brandColor, setBrandColor] = useState(initialData.brandColor || '#A7F3D0')
  const [tagline, setTagline] = useState(initialData.tagline)
  const [abn, setAbn] = useState(initialData.abn)
  const [showContactOnDocuments, setShowContactOnDocuments] = useState(
    initialData.showContactOnDocuments || false
  )
  const [logoLoading, setLogoLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const isDirty =
    logoUrl !== initialData.logoUrl ||
    brandColor !== (initialData.brandColor || '#A7F3D0') ||
    tagline !== initialData.tagline ||
    abn !== initialData.abn ||
    showContactOnDocuments !== (initialData.showContactOnDocuments || false)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast('Logo must be less than 2MB', 'error')
      return
    }

    setLogoLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data', 'error')
      setLogoLoading(false)
      return
    }

    const fileName = `${user.id}/logo`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      toast(uploadError.message, 'error')
      setLogoLoading(false)
      return
    }

    const { data } = supabase.storage.from('branding').getPublicUrl(fileName)
    setLogoUrl(`${data.publicUrl}?t=${Date.now()}`)
    setLogoLoading(false)
  }

  const handleRemoveLogo = () => {
    setLogoUrl('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data', 'error')
      setLoading(false)
      return
    }

    const existingMetadata = user.user_metadata || {}
    const updatedMetadata = {
      ...existingMetadata,
      logo_url: logoUrl || null,
      brand_color: brandColor,
      tagline: tagline || null,
      abn: abn || null,
      show_contact_on_documents: showContactOnDocuments,
    }

    const { error } = await supabase.auth.updateUser({
      data: updatedMetadata,
    })

    if (error) {
      toast(error.message, 'error')
      setLoading(false)
      return
    }

    toast('Branding saved.')
    setLoading(false)
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Branding</h2>
      <p className="text-sm text-gray-500 mb-8">
        Customise how your quote and invoice links look to couples.
      </p>

      {/* Two-column layout: form | preview */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* === FORM COLUMN === */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-lg space-y-6">

          {/* --- Logo section --- */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Logo</p>
            <div className="space-y-3">
              {logoUrl && (
                <div className="flex flex-col items-start gap-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="max-h-16 object-contain bg-white border border-gray-200 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
              <label
                className={`block border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-center cursor-pointer transition ${
                  logoLoading ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400'
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={logoLoading}
                  className="hidden"
                />
                <p className="text-xs font-medium text-gray-600">
                  {logoLoading ? 'Uploading...' : 'Click or drag to upload'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG · Max 2MB</p>
              </label>
            </div>
          </div>

          {/* --- Appearance section --- */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Appearance</p>
            <div className="space-y-4">

              {/* Brand Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Colour</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className={inputClass}
                    placeholder="#A7F3D0"
                  />
                </div>
                {/* Button preview */}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium rounded-xl px-4 py-2 transition cursor-default"
                    style={{ backgroundColor: brandColor, color: getTextColor(brandColor) }}
                    tabIndex={-1}
                  >
                    Accept Quote
                  </button>
                  <span className="text-xs text-gray-400">Button preview</span>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Tagline</label>
                  <span className="text-xs text-gray-400">{tagline.length}/80</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className={inputClass}
                  placeholder="Creating unforgettable moments"
                />
              </div>

            </div>
          </div>

          {/* --- Documents section --- */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Documents</p>
            <div className="space-y-4">

              {/* ABN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Australian Business Number (ABN)
                </label>
                <input
                  type="text"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className={inputClass}
                  placeholder="00 000 000 000"
                />
                <p className="mt-1 text-xs text-gray-400">Displayed on invoice headers. 11 digits.</p>
              </div>

              {/* Show contact with help popover */}
              <div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="show-contact"
                    checked={showContactOnDocuments}
                    onChange={(e) => setShowContactOnDocuments(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: brandColor }}
                  />
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="show-contact"
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      Show contact details on quote and invoice pages
                    </label>

                    {/* HelpCircle popover */}
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                          aria-label="What contact details are shown?"
                        >
                          <HelpCircle size={14} strokeWidth={1.5} />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 max-w-xs z-50"
                          sideOffset={6}
                          align="start"
                        >
                          <p className="text-xs text-gray-600 leading-relaxed">
                            Shows your phone number, website, Instagram, and Facebook on the public quote and invoice pages visible to your clients.
                          </p>
                          <Popover.Arrow className="fill-white stroke-gray-200" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Sticky save bar — only rendered when dirty */}
          {isDirty && (
            <div className="sticky bottom-0 bg-white border-t border-gray-100 py-4 px-0 flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white text-sm font-medium rounded-xl px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save Branding'}
              </button>
              <span className="text-sm text-gray-400">Unsaved changes</span>
            </div>
          )}

        </form>

        {/* === PREVIEW COLUMN === */}
        <div className="w-full lg:w-72 shrink-0">
          <BrandingPreview
            logoUrl={logoUrl}
            brandColor={brandColor}
            tagline={tagline}
            businessName={initialData.businessName}
            abn={abn}
            showContactOnDocuments={showContactOnDocuments}
            phone={initialData.phone}
            website={initialData.website}
            instagramUrl={initialData.instagramUrl}
            facebookUrl={initialData.facebookUrl}
          />
        </div>

      </div>
    </div>
  )
}
