/**
 * The interactive answer control for a single questionnaire question on the
 * couple-facing page. Branded with the MC's colours/radius via inline styles,
 * matching the other public surfaces. Choice and yes/no answers auto-advance;
 * text answers wait for the couple to press Next.
 *
 * @module app/questionnaire/[token]/_components/question-field
 */
'use client'

import type { Answer, Question } from '@/lib/questionnaires/question-schema'

import { readableTextOn } from './public-questionnaire'

interface FieldProps {
  question: Question
  value: Answer | undefined
  onChange: (value: Answer) => void
  /** Called after picking a choice/yes-no answer, to glide to the next step. */
  onAutoAdvance?: () => void
  brand: string
  textColor: string
  radius: number
}

const INPUT_CLASS = 'w-full border bg-white px-4 py-3 text-lg outline-none transition focus:border-current'

export function QuestionField({ question, value, onChange, onAutoAdvance, brand, textColor, radius }: FieldProps) {
  const borderStyle = { borderColor: '#e5e7eb', borderRadius: radius, color: textColor }

  switch (question.type) {
    case 'long_text':
      return (
        <textarea
          autoFocus
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
          style={borderStyle}
        />
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
                style={{ borderRadius: radius, borderColor: isSel ? brand : '#e5e7eb', background: isSel ? `${brand}22` : '#fff', color: textColor }}
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
                style={{ borderRadius: radius, borderColor: isSel ? brand : '#e5e7eb', background: isSel ? `${brand}22` : '#fff', color: textColor }}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded border" style={{ borderColor: isSel ? brand : '#cbd5e1', background: isSel ? brand : '#fff' }}>
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
      const inputType = question.type === 'date' ? 'date' : question.type === 'time' ? 'time' : question.type === 'number' ? 'number' : 'text'
      return (
        <input
          autoFocus
          type={inputType}
          inputMode={question.type === 'number' ? 'decimal' : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
          style={borderStyle}
        />
      )
    }
  }
}
