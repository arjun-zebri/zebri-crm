/**
 * The interactive answer control for a single questionnaire question, shared
 * by the couple-facing fill page and every MC-side preview. Branded with the
 * MC's colours/radius via inline styles (matching the other public surfaces),
 * so it renders identically wherever it appears. Choice and yes/no answers
 * auto-advance in the typeform flow; text answers wait for Next.
 *
 * @module components/questionnaires/question-field
 */
'use client'

import type { Answer, Question } from '@/lib/questionnaires/question-schema'

import { readableTextOn, type QuestionnaireTheme } from './theme'

interface FieldProps {
  question: Question
  value: Answer | undefined
  onChange: (value: Answer) => void
  /** Called after picking a choice/yes-no answer, to glide to the next step. */
  onAutoAdvance?: () => void
  /** Focus the control on mount — used by the one-at-a-time flow only. */
  autoFocus?: boolean
  theme: QuestionnaireTheme
}

const INPUT_CLASS = 'w-full border px-4 py-3 outline-none transition focus:border-current'

/** Placeholder hints so empty inputs read as invitations, not gaps. */
const PLACEHOLDERS: Partial<Record<Question['type'], string>> = {
  short_text: 'Type your answer…',
  long_text: 'Type your answer…',
  email: 'name@example.com',
  phone: '0400 000 000',
}

export function QuestionField({ question, value, onChange, onAutoAdvance, autoFocus = false, theme }: FieldProps) {
  const { brand, textColor, borderColor, radius, pageBg } = theme
  // Use theme properties for styling: pageBg for backgrounds (from surface_color), borderColor for outlines.
  const borderStyle = { borderColor, borderRadius: radius, color: textColor, backgroundColor: pageBg }

  switch (question.type) {
    case 'long_text':
      return (
        <textarea
          autoFocus={autoFocus}
          rows={6}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDERS.long_text}
          className={`${INPUT_CLASS} resize-none`}
          style={borderStyle}
        />
      )

    case 'dropdown':
      return (
        <select
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value)
            if (e.target.value) onAutoAdvance?.()
          }}
          className={`${INPUT_CLASS} cursor-pointer appearance-none`}
          style={borderStyle}
        >
          <option value="">Choose one…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )

    case 'single_choice':
    case 'yes_no': {
      const options = question.type === 'yes_no' ? ['Yes', 'No'] : (question.options ?? [])
      const selected = typeof value === 'string' ? value : ''
      return (
        <div className="space-y-2">
          {options.map((opt) => {
            const isSel = selected === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt)
                  onAutoAdvance?.()
                }}
                className="flex w-full cursor-pointer items-center justify-between border px-4 py-3 text-left text-lg transition hover:border-current"
                style={{ borderRadius: radius, borderColor: isSel ? brand : borderColor, background: isSel ? `${brand}22` : pageBg, color: textColor }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )
    }

    case 'multiple_choice': {
      const selected = Array.isArray(value) ? value : []
      const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => {
            const isSel = selected.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full cursor-pointer items-center gap-3 border px-4 py-3 text-left text-lg transition hover:border-current"
                style={{ borderRadius: radius, borderColor: isSel ? brand : borderColor, background: isSel ? `${brand}22` : pageBg, color: textColor }}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded border" style={{ borderColor: isSel ? brand : borderColor, background: isSel ? brand : pageBg }}>
                  {isSel && <span className="text-xs" style={{ color: readableTextOn(brand) }}>✓</span>}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      )
    }

    default: {
      const inputType =
        question.type === 'date' ? 'date'
        : question.type === 'time' ? 'time'
        : question.type === 'number' ? 'number'
        : question.type === 'email' ? 'email'
        : question.type === 'phone' ? 'tel'
        : 'text'
      const inputMode = question.type === 'number' ? 'decimal' : question.type === 'phone' ? 'tel' : question.type === 'email' ? 'email' : undefined
      return (
        <input
          autoFocus={autoFocus}
          type={inputType}
          inputMode={inputMode}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDERS[question.type]}
          className={INPUT_CLASS}
          style={borderStyle}
        />
      )
    }
  }
}
