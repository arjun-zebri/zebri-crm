'use client'

import { Upload, Trash2, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'

import { Input } from '@/components/ui/input'

/**
 * BusinessSection - Edits MC branding identity fields
 * Rendered as the first accordion in the brand panel rail.
 */
interface BusinessSectionProps {
  businessName: string
  setBusinessName: (v: string) => void
  tagline: string
  setTagline: (v: string) => void
  abn: string
  setAbn: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  website: string
  setWebsite: (v: string) => void
  instagramUrl: string
  setInstagramUrl: (v: string) => void
  facebookUrl: string
  setFacebookUrl: (v: string) => void
  twitterUrl: string
  setTwitterUrl: (v: string) => void
  pinterestUrl: string
  setPinterestUrl: (v: string) => void
  faviconUrl: string
  uploadFavicon: (file: File) => Promise<void>
  removeFavicon: () => void
}

export function BusinessSection(props: BusinessSectionProps) {
  return (
    <div className="space-y-3">
      <TextField label="Business name" value={props.businessName} onChange={props.setBusinessName} placeholder="Your business name" />
      <TextField label="Tagline" value={props.tagline} onChange={props.setTagline} placeholder="A short line about you" />
      <TextField label="Phone" value={props.phone} onChange={props.setPhone} placeholder="+61 2 9000 0000" />
      <TextField label="Website" value={props.website} onChange={props.setWebsite} placeholder="www.yourbusiness.com" />
      <TextField label="Instagram URL" value={props.instagramUrl} onChange={props.setInstagramUrl} placeholder="instagram.com/youraccount" />
      <TextField label="Facebook URL" value={props.facebookUrl} onChange={props.setFacebookUrl} placeholder="facebook.com/youraccount" />
      <TextField label="Twitter URL" value={props.twitterUrl} onChange={props.setTwitterUrl} placeholder="x.com/youraccount" />
      <TextField label="Pinterest URL" value={props.pinterestUrl} onChange={props.setPinterestUrl} placeholder="pinterest.com/youraccount" />
      <TextField label="ABN" value={props.abn} onChange={props.setAbn} placeholder="00 000 000 000" />
      <IdentityTile label="Favicon" hint="Browser tab · 256KB" url={props.faviconUrl} onUpload={props.uploadFavicon} onRemove={props.removeFavicon} accept="image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon" square />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  // Keep the rail's uppercase field-label style; use the shared Input
  // primitive for the control (design-system rule: no raw <input>).
  return (
    <div className="block">
      <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em] mb-1 block">{label}</span>
      <Input
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  )
}

function IdentityTile({ label, hint, url, onUpload, onRemove, accept, square }: { label: string; hint?: string; url: string; onUpload: (file: File) => Promise<void>; onRemove: () => void; accept: string; square?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hovering, setHovering] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const filled = !!url

  const onFile = async (f: File) => {
    setUploading(true)
    try { await onUpload(f) } catch { /* upstream */ } finally { setUploading(false) }
  }

  const openPicker = () => inputRef.current?.click()
  const sizeClass = square ? 'w-16 h-16' : 'w-full h-16'

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
    <div className="space-y-1" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div role="button" tabIndex={0} onClick={openPicker} onKeyDown={handleKeyDown} onDragOver={handleDragOver} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`relative ${sizeClass} rounded-xl bg-gray-50 border border-dashed flex items-center justify-center overflow-hidden cursor-pointer outline-none focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10 transition ${dragging ? 'border-gray-900 bg-gray-100' : filled ? 'border-gray-200 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'}`}>
        {filled && url ? <Image src={url} alt="" className="max-w-[80%] max-h-[80%] object-contain pointer-events-none" width={64} height={64} /> : uploading ? <span className="text-[10px] text-gray-400 pointer-events-none">Uploading...</span> : <ImageIcon size={20} strokeWidth={1.25} className="text-gray-400 pointer-events-none opacity-50" />}
        {filled && hovering && <span className="absolute inset-0 bg-gray-900/40 flex items-center justify-center pointer-events-none"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 text-gray-800 text-[11px] font-medium shadow-sm"><Upload size={11} strokeWidth={2} />Replace</span></span>}
        {filled && <button type="button" onClick={(e) => { e.stopPropagation(); onRemove() }} className={`absolute top-1.5 right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm cursor-pointer transition ${hovering ? 'opacity-100' : 'opacity-0'}`}><Trash2 size={12} strokeWidth={1.75} /></button>}
      </div>
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-medium text-gray-600 uppercase tracking-[0.06em]">{label}</p>
        {hint && <p className="text-[10px] text-gray-400 truncate">{hint}</p>}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); if (inputRef.current) inputRef.current.value = '' }} />
    </div>
  )
}
