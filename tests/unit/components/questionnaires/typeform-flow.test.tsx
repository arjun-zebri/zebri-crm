/**
 * Tests for TypeformFlow's step sizing.
 *
 * The step area reserves a minimum height so the layout does not jump as the
 * couple moves between questions. The live page can afford a tall floor
 * because it fills the viewport; a preview frame cannot, where 300px of
 * reserved space under a one-line answer reads as a large empty gap.
 */
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

import { themeFromBranding } from '@/components/questionnaires/theme'
import { TypeformFlow } from '@/components/questionnaires/typeform-flow'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { Question } from '@/lib/questionnaires/question-schema'

const questions: Question[] = [
  { id: 'q1', type: 'short_text', label: 'What is your name?', required: false },
  { id: 'q2', type: 'short_text', label: 'Where is the venue?', required: false },
]

const branding = buildPublicBranding({})
const theme = themeFromBranding(branding)

function renderFlow(mode: 'live' | 'preview') {
  return render(
    <TypeformFlow
      questions={questions}
      responses={{}}
      onAnswer={() => {}}
      theme={theme}
      mode={mode}
      branding={branding}
    />
  )
}

/** The step area is the scrolling region that holds the current question. */
function stepArea(container: HTMLElement): HTMLElement {
  const step = container.querySelector('[class*="overflow-y-auto"]')
  if (!(step instanceof HTMLElement)) throw new Error('step area not found')
  return step
}

describe('TypeformFlow step sizing', () => {
  it('reserves the full step height on the live fill page', () => {
    const { container } = renderFlow('live')
    expect(stepArea(container).className).toContain('min-h-[300px]')
  })

  it('reserves less step height in a preview frame', () => {
    const { container } = renderFlow('preview')
    const className = stepArea(container).className
    expect(className).not.toContain('min-h-[300px]')
    expect(className).toContain('min-h-[180px]')
  })
})
