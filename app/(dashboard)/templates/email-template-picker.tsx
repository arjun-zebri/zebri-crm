/**
 * Email-template picker — a Select bound to the MC's saved templates.
 *
 * Reused by the automation `send_email` inspector to choose a template
 * (or write inline). Labels each option with its category so long
 * libraries stay scannable.
 *
 * @module app/(dashboard)/templates/email-template-picker
 */
'use client'

import { Select } from '@/components/ui/select'

import { useCategories } from './use-categories'
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
  const { data: categories = [] } = useCategories()
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name
  return (
    <Select
      label={label}
      size="sm"
      value={value || INLINE}
      onValueChange={(v) => onChange(v === INLINE ? '' : v)}
      options={[
        { value: INLINE, label: 'Write inline (no template)' },
        // Archived templates are hidden, except the one currently
        // selected — an automation referencing it must keep displaying.
        ...templates
          .filter((t) => !t.archived_at || t.id === value)
          .map((t) => {
            const category = categoryName(t.category_id)
            const name = t.archived_at ? `${t.name} (archived)` : t.name
            return { value: t.id, label: category ? `${name} · ${category}` : name }
          }),
      ]}
    />
  )
}
