'use client'

import { Upload, Trash2, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

/**
 * Props for the business identity step.
 * @internal
 */
interface StepBusinessProps {
  businessName: string
  setBusinessName: (v: string) => void
  tagline: string
  setTagline: (v: string) => void
  logoUrl: string
  setLogoUrl: (v: string) => void
}

/**
 * StepBusiness — Collect MC identity: name, tagline, logo.
 *
 * Logo upload uses the same branding storage path pattern as the main editor.
 * @internal
 */
export function StepBusiness(props: StepBusinessProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-text mb-4">Let's start with your identity</h2>
        <p className="text-sm text-text-muted">We'll use these to brand all your documents.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Business name</label>
          <Input
            value={props.businessName}
            onChange={(e) => props.setBusinessName(e.target.value)}
            placeholder="Your business name"
            aria-label="Business name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Tagline</label>
          <Input
            value={props.tagline}
            onChange={(e) => props.setTagline(e.target.value)}
            placeholder="A short line about you"
            aria-label="Tagline"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Logo</label>
          <LogoUpload logoUrl={props.logoUrl} setLogoUrl={props.setLogoUrl} />
        </div>
      </div>
    </div>
  )
}

/**
 * LogoUpload — Reusable logo upload tile with drag-drop and preview.
 * @internal
 */
function LogoUpload({ logoUrl, setLogoUrl }: { logoUrl: string; setLogoUrl: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hovering, setHovering] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const filled = !!logoUrl

  /**
   * Upload logo to branding storage (same path pattern as branding-editor).
   */
  const uploadLogo = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      console.error('Logo too large (>2MB)')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id
      const path = `${userId}/logo`
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/branding/${path}`
      const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

      const body = await file.arrayBuffer()
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey,
          'x-upsert': 'true',
          'Content-Type': file.type || 'application/octet-stream',
          'Cache-Control': 'max-age=3600',
        },
        body,
      })

      if (!res.ok) {
        console.error('Logo upload failed', res.status)
        return
      }

      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      setLogoUrl(`${data.publicUrl}?t=${Date.now()}`)
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = async () => {
    setLogoUrl('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.storage.from('branding').remove([`${user.id}/logo`])
    }
  }

  const onFile = async (f: File) => {
    await uploadLogo(f)
  }

  const openPicker = () => inputRef.current?.click()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="space-y-2" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative w-full h-32 rounded-xl bg-surface border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/50 transition ${
          dragging
            ? 'border-brand bg-brand/5'
            : filled
              ? 'border-border hover:border-brand'
              : 'border-border-muted hover:border-border'
        }`}
      >
        {filled && logoUrl ? (
          <Image src={logoUrl} alt="Logo preview" className="max-w-[80%] max-h-[80%] object-contain pointer-events-none" width={128} height={128} />
        ) : uploading ? (
          <span className="text-xs text-text-muted pointer-events-none">Uploading...</span>
        ) : (
          <ImageIcon size={24} strokeWidth={1.5} className="text-text-muted pointer-events-none opacity-50" />
        )}
        {filled && hovering && (
          <span className="absolute inset-0 bg-text/5 flex items-center justify-center pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface/95 text-text text-xs font-medium shadow-sm">
              <Upload size={12} strokeWidth={2} />
              Replace
            </span>
          </span>
        )}
        {filled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeLogo()
            }}
            className={`absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface/95 backdrop-blur-sm border border-border text-text-muted hover:text-text hover:border-border-strong shadow-sm cursor-pointer transition ${
              hovering ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <p className="text-xs text-text-muted">PNG, JPEG, SVG up to 2MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
        aria-label="Logo upload"
      />
    </div>
  )
}
