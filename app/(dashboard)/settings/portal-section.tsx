'use client'

import { Clock, Users2, Receipt, FileSignature, Music, FileText, Heart } from 'lucide-react'
import { useState, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

interface PortalSectionSettings {
  timeline: boolean
  contacts: boolean
  payments: boolean
  contracts: boolean
  songs: boolean
  files: boolean
  vows: boolean
}

interface PortalSectionProps {
  initialSettings: PortalSectionSettings | null
}

const SECTION_DEFS = [
  { id: 'timeline' as const, label: 'Timeline', icon: Clock, description: 'Couples can view and submit timeline items' },
  { id: 'contacts' as const, label: 'Contacts', icon: Users2, description: 'Wedding party and vendor contacts' },
  { id: 'payments' as const, label: 'Payments', icon: Receipt, description: 'Quotes and invoices' },
  { id: 'contracts' as const, label: 'Contracts', icon: FileSignature, description: 'Contracts for review and signing' },
  { id: 'songs' as const, label: 'Songs', icon: Music, description: 'Music requests by category' },
  { id: 'files' as const, label: 'Files', icon: FileText, description: 'Document and photo uploads' },
  { id: 'vows' as const, label: 'Vows', icon: Heart, description: 'Couples write their ceremony vows' },
]

const DEFAULT_SETTINGS: PortalSectionSettings = {
  timeline: true,
  contacts: true,
  payments: true,
  contracts: true,
  songs: true,
  files: true,
  vows: true,
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-pill transition-colors cursor-pointer ${
        enabled ? 'bg-black' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-pill bg-surface shadow transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function PortalSection({ initialSettings }: PortalSectionProps) {
  const { toast } = useToast()
  const savedRef = useRef<PortalSectionSettings>(initialSettings ?? DEFAULT_SETTINGS)
  const [settings, setSettings] = useState<PortalSectionSettings>(initialSettings ?? DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  const isDirty = SECTION_DEFS.some(s => settings[s.id] !== savedRef.current[s.id])

  const toggle = (id: keyof PortalSectionSettings) => {
    setSettings(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data.', 'error')
      setSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, portal_sections: settings },
    })
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Portal settings saved.')
      savedRef.current = { ...settings }
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-section font-semibold text-text mb-1">Couple Portal</h2>
        <p className="text-body text-text-muted mb-6">Choose which sections are visible in the couple portal. Changes apply to all couples.</p>

        <div className="space-y-0 border border-border rounded-control overflow-hidden">
          {SECTION_DEFS.map((section, i) => {
            const Icon = section.icon
            return (
              <div
                key={section.id}
                className={`flex items-center justify-between px-4 py-3.5 ${
                  i < SECTION_DEFS.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={15} className="text-text-subtle flex-shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-body font-medium text-text">{section.label}</p>
                    <p className="text-body text-text-subtle">{section.description}</p>
                  </div>
                </div>
                <Toggle enabled={settings[section.id]} onChange={() => toggle(section.id)} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!isDirty} loading={saving}>
          Save
        </Button>
        {isDirty && <span className="text-body text-text-subtle">Unsaved changes</span>}
      </div>
    </div>
  )
}
