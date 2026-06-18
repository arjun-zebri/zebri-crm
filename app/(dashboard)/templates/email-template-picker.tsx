/**
 * Email-template picker — a Select bound to the MC's saved templates.
 *
 * Reused by the automation `send_email` inspector to choose a template
 * (or write inline). Suggests templates whose lifecycle stage matches a
 * hint, but never hides the rest.
 *
 * @module app/(dashboard)/templates/email-template-picker
 */
'use client'

import { Select } from '@/components/ui/select'
import { LIFECYCLE_LABELS } from '@/types/email-template'

import { useTemplates } from './use-templates'

// Radix Select forbids an empty-string item value; the "write inline"
// choice uses a sentinel that maps back to '' for the caller.
const INLINE = '__inline__'

interface EmailTemplatePickerProps {
  value: string
  onChange: (templateId: string) => void
  label?: string
}

export function EmailTemplatePicker({ value, onChange, label = 'Email template' }: EmailTemplatePickerProps) {
  const { data: templates = [] } = useTemplates()
  return (
    <Select
      label={label}
      value={value || INLINE}
      onValueChange={(v) => onChange(v === INLINE ? '' : v)}
      options={[
        { value: INLINE, label: 'Write inline (no template)' },
        ...templates.map((t) => ({
          value: t.id,
          label: t.lifecycle_stage ? `${t.name} · ${LIFECYCLE_LABELS[t.lifecycle_stage]}` : t.name,
        })),
      ]}
    />
  )
}
