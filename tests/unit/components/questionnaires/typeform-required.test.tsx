/**
 * Required-answer handling in the one-at-a-time flow.
 *
 * Two rules: a preview is for looking through the questions, so it never
 * blocks the MC on answers they are not really giving; and on the live page
 * the message has to say what to do, not scold with "This one is required."
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

import { themeFromBranding } from '@/components/questionnaires/theme'
import { TypeformFlow } from '@/components/questionnaires/typeform-flow'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { Question } from '@/lib/questionnaires/question-schema'

const questions: Question[] = [
  { id: 'q1', type: 'short_text', label: 'Partner 1 full name', required: true },
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

describe('TypeformFlow required answers', () => {
  it('lets the MC page through a preview without answering', async () => {
    renderFlow('preview')
    expect(screen.getByText('Partner 1 full name')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Where is the venue?')).toBeInTheDocument()
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
  })

  it('holds the couple on an unanswered required question', async () => {
    renderFlow('live')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Partner 1 full name')).toBeInTheDocument()
    expect(screen.queryByText('Where is the venue?')).not.toBeInTheDocument()
  })

  it('asks for the answer instead of announcing a rule', async () => {
    renderFlow('live')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Please answer this to continue.')).toBeInTheDocument()
    expect(screen.queryByText('This one is required.')).not.toBeInTheDocument()
  })
})
