'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

/** A single partner's editable contact triple. */
export interface ContactTriple {
  name: string
  email: string
  phone: string
}

interface ContactDetailsCardProps {
  /** Quiet subheading, e.g. "Primary contact". */
  label: string
  /** Current persisted values (also the initial editor state). */
  value: ContactTriple
  /** Commit handler - fired on blur only when a field actually changed. */
  onSave: (next: ContactTriple) => void
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * Editable contact group for one partner (name / email / phone).
 *
 * Mirrors the couple-modal Overview style: borderless inline rows with a
 * left-aligned label and a right-aligned value, a hover-pencil hint, and
 * save-on-blur. Owns its own field state so typing stays snappy; commits
 * via `onSave` only when a value actually changed, so tabbing through
 * untouched fields never triggers a redundant network write.
 */
export function ContactDetailsCard({ label, value, onSave, branding }: ContactDetailsCardProps) {
  const [triple, setTriple] = useState<ContactTriple>(value)
  const labelDefaults = roleDefaults(branding, 'sectionLabel')

  const commit = () => {
    if (triple.name !== value.name || triple.email !== value.email || triple.phone !== value.phone) {
      onSave(triple)
    }
  }

  return (
    <div>
      <h4
        style={{
          fontSize: `${labelDefaults.fontSize}px`,
          color: labelDefaults.color,
          fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
          fontWeight: labelDefaults.fontWeight,
          lineHeight: labelDefaults.lineHeight,
          letterSpacing: `${labelDefaults.letterSpacing}px`,
          textTransform: labelDefaults.textTransform === 'uppercase' ? 'uppercase' : undefined,
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </h4>
      <EditableRow label="Name" type="text" value={triple.name} placeholder="Full name"
        onChange={(v) => setTriple((t) => ({ ...t, name: v }))} onCommit={commit} branding={branding} />
      <EditableRow label="Email" type="email" value={triple.email} placeholder="email@example.com"
        onChange={(v) => setTriple((t) => ({ ...t, email: v }))} onCommit={commit} branding={branding} />
      <EditableRow label="Phone" type="tel" value={triple.phone} placeholder="+61 400 000 000"
        onChange={(v) => setTriple((t) => ({ ...t, phone: v }))} onCommit={commit} branding={branding} />
    </div>
  )
}

interface EditableRowProps {
  label: string
  type: 'text' | 'email' | 'tel'
  value: string
  placeholder: string
  onChange: (value: string) => void
  onCommit: () => void
  branding: PublicBranding
}

/** One borderless inline field: label left, value right, hover-pencil hint. */
function EditableRow({ label, type, value, placeholder, onChange, onCommit, branding }: EditableRowProps) {
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  return (
    <div className="group flex items-center justify-between py-2 -mx-2 px-2">
      <span
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
          width: '5rem',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
        <input
          type={type}
          value={value}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.cursor = 'pointer'
            onCommit()
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          style={{
            flex: 1,
            textAlign: 'right',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            fontSize: `${bodyDefaults.fontSize}px`,
            color: bodyDefaults.color,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
            cursor: 'pointer',
          }}
          className="focus:cursor-text"
          onFocus={(e) => { (e.target as HTMLInputElement).style.cursor = 'text' }}
        />
        <Pencil size={11} strokeWidth={1.5} className="shrink-0 opacity-0 group-hover:opacity-60 transition" style={{ color: finePrintDefaults.color }} />
      </div>
    </div>
  )
}
