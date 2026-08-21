/**
 * Tests for the questionnaire experience preview frame.
 *
 * One-at-a-time (typeform) mode must not scroll the frame and must not
 * stretch the flow to fill it: stretching pushed the progress bar into the
 * middle of the frame and the Next button off the bottom, leaving a dead gap
 * under short questions. All-on-one-page (form) mode legitimately scrolls.
 */
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'

import { QuestionnaireExperiencePreview } from '@/components/questionnaires/experience-preview'
import type { Question } from '@/lib/questionnaires/question-schema'

const mockQuestions: Question[] = [
  {
    id: 'q1',
    type: 'short_text',
    label: 'What is your name?',
    required: false,
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    label: 'What is your favorite color?',
    required: true,
    options: ['Red', 'Blue', 'Green'],
  },
]

// Mock useCurrentBranding to avoid needing Supabase
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({
    branding: {
      brand_color: '#111827',
      heading_color: '#111827',
      subheading_color: '#6B7280',
      surface_color: '#FFFFFF',
      text_color: '#111827',
      secondary_color: '#6B7280',
      border_color: '#E5E7EB',
      corner_radius: 8,
      tagline: '',
      logo_url: '',
      favicon_url: '',
      header_image_url: '',
      font_heading: 'inter',
      font_body: 'inter',
      font_weight: 600,
      font_body_weight: 400,
      density: 'cozy',
      body_size: 14,
      heading_size: 32,
      heading_case: 'none',
      body_case: 'none',
      subheading_size: 14,
      subheading_weight: 600,
      subheading_case: 'uppercase',
      heading_letter_spacing: 0,
      body_line_height: 1.5,
      link_color: '#111827',
      button_variant: 'fill',
      button_size: 'md',
      button_radius: 8,
      section_spacing: 32,
    },
    loading: false,
  }),
}))

/** The frame is the preview's outermost element, carrying the height class. */
function frameOf(container: HTMLElement): HTMLElement {
  const frame = container.firstElementChild
  if (!(frame instanceof HTMLElement)) throw new Error('preview frame not found')
  return frame
}

/** The flow root carries TypeformFlow's own max-height cap. */
function flowRoot(container: HTMLElement): HTMLElement {
  const flow = container.querySelector('[class*="max-h-[560px]"]')
  if (!(flow instanceof HTMLElement)) throw new Error('typeform flow not found')
  return flow
}

function renderPreview(displayMode: 'form' | 'typeform') {
  return render(
    <QuestionnaireExperiencePreview
      title="Test questionnaire"
      questions={mockQuestions}
      displayMode={displayMode}
      heightClass="h-[560px]"
    />
  )
}

describe('QuestionnaireExperiencePreview frame layout', () => {
  it('scrolls the frame in all-on-one-page mode', () => {
    const { container } = renderPreview('form')
    expect(frameOf(container).className).toContain('overflow-y-auto')
  })

  it('does not scroll the frame in one-at-a-time mode', () => {
    const { container } = renderPreview('typeform')
    expect(frameOf(container).className).not.toContain('overflow-y-auto')
  })

  it('keeps the one-at-a-time content at its natural height instead of stretching it', () => {
    const { container } = renderPreview('typeform')
    const wrapper = flowRoot(container).parentElement
    expect(wrapper).not.toBeNull()

    // The content sits at the top of the frame at its own height. A flex-1
    // chain here is what spread the progress bar and nav across the whole
    // frame, leaving a dead gap under short questions.
    expect(wrapper!.className).toContain('mx-auto')
    expect(wrapper!.className).not.toContain('flex-1')
  })

  it('shows the title in both modes', () => {
    expect(renderPreview('typeform').container.textContent).toContain('Test questionnaire')
    expect(renderPreview('form').container.textContent).toContain('Test questionnaire')
  })
})
