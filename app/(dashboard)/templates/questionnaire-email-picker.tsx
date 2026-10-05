/**
 * "Send with" picker on a questionnaire template: which of the MC's email
 * templates goes out with the questionnaire (manual send, resend and
 * workflow steps), or the standard questionnaire email.
 *
 * @module app/(dashboard)/templates/questionnaire-email-picker
 */
'use client'

import { Select } from '@/components/ui/select'

import { useTemplates } from './use-templates'

/**
 * The shared Select crashes on an empty-string option value, so "no
 * template" is a sentinel that maps back to null.
 */
const STANDARD = 'standard'

interface QuestionnaireEmailPickerProps {
  /** The chosen email template id, or null for the standard email. */
  value: string | null
  onChange: (emailTemplateId: string | null) => void
}

/** Select of the MC's active email templates, plus the standard email. */
export function QuestionnaireEmailPicker({ value, onChange }: QuestionnaireEmailPickerProps) {
  const { data: templates } = useTemplates()
  const active = (templates ?? []).filter((t) => !t.archived_at)
  // A chosen template that has since been archived still shows, so the
  // field never claims a different email than the one on file.
  const chosen = (templates ?? []).find((t) => t.id === value)
  const options = [
    { value: STANDARD, label: 'Standard questionnaire email' },
    ...active.map((t) => ({ value: t.id, label: t.name })),
    ...(chosen?.archived_at ? [{ value: chosen.id, label: `${chosen.name} (archived, standard email sent)` }] : []),
  ]

  return (
    <Select
      label="Send with"
      help="Include the Questionnaire link variable. Without it the standard email is sent."
      value={value ?? STANDARD}
      onValueChange={(v) => onChange(v === STANDARD ? null : v)}
      options={options}
    />
  )
}
