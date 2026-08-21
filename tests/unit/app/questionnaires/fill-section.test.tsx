/**
 * Tests for the public questionnaire fill experience: verify that the template
 * description is rendered under the title in both form and typeform modes,
 * and that it's only shown when non-empty.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

import { FillSection } from '@/app/questionnaire/[token]/_components/fill-section'
import type { PublicQuestionnaire } from '@/app/questionnaire/[token]/_components/public-questionnaire'
import { themeFromBranding } from '@/components/questionnaires/theme'

const mockQuestionnaire: PublicQuestionnaire = {
  id: 'test-id',
  title: 'Test Questionnaire',
  description: 'This is a test description',
  status: 'sent',
  display_mode: 'form',
  questions: [
    {
      id: 'q1',
      type: 'short_text',
      label: 'Your name',
      required: false,
    },
  ],
  responses: {},
  completed_at: null,
  couple_name: 'Test Couple',
  branding_blocks: [],
  // PublicBranding fields (complete set required by interface)
  logo_url: '',
  favicon_url: '',
  header_image_url: '',
  brand_color: '#111827',
  heading_color: '#111827',
  subheading_color: '#6B7280',
  subheading_size: 14,
  subheading_weight: 600,
  subheading_case: 'none',
  accent_color: '#111827',
  surface_color: '#FFFFFF',
  text_color: '#111827',
  muted_color: '#6B7280',
  secondary_color: '#6B7280',
  secondary_text_color: '#6B7280',
  business_name: 'Test MC',
  tagline: '',
  abn: '',
  phone: '',
  website: '',
  instagram_url: '',
  facebook_url: '',
  twitter_url: '',
  pinterest_url: '',
  website_url: '',
  show_contact_on_documents: false,
  font_heading: 'inter',
  font_body: 'inter',
  font_weight: 600,
  font_body_weight: 400,
  font_scale: 1,
  density: 'cozy',
  corner_radius: 8,
  doc_padding: 12,
  theme_preset: 'minimal',
  email_show_logo: true,
  email_logo_align: 'left',
  email_show_accent: true,
  heading_size: 32,
  body_size: 14,
  heading_case: 'none',
  body_case: 'none',
  heading_letter_spacing: 0,
  body_line_height: 1.5,
  link_color: '#111827',
  border_color: '#E5E7EB',
  button_variant: 'fill',
  button_size: 'md',
  button_radius: 8,
  section_spacing: 32,
  page_background: '#FFFFFF',
}

describe('FillSection description rendering', () => {
  const theme = themeFromBranding(mockQuestionnaire)
  const noop = () => {}

  it('renders the description under the title in form mode', () => {
    render(
      <FillSection
        questionnaire={mockQuestionnaire}
        token="test-token"
        theme={theme}
        onCompleted={noop}
        displayMode="form"
      />
    )

    expect(screen.getByText('Test Questionnaire')).toBeInTheDocument()
    expect(screen.getByText('This is a test description')).toBeInTheDocument()
  })

  it('renders the description under the title in oneAtATime mode', () => {
    render(
      <FillSection
        questionnaire={{
          ...mockQuestionnaire,
          display_mode: 'typeform',
        }}
        token="test-token"
        theme={theme}
        onCompleted={noop}
        displayMode="oneAtATime"
      />
    )

    expect(screen.getByText('Test Questionnaire')).toBeInTheDocument()
    expect(screen.getByText('This is a test description')).toBeInTheDocument()
  })

  it('does not render description when it is null', () => {
    render(
      <FillSection
        questionnaire={{
          ...mockQuestionnaire,
          description: null,
        }}
        token="test-token"
        theme={theme}
        onCompleted={noop}
        displayMode="form"
      />
    )

    expect(screen.getByText('Test Questionnaire')).toBeInTheDocument()
    expect(screen.queryByText('This is a test description')).not.toBeInTheDocument()
  })

  it('does not render description when it is an empty string', () => {
    render(
      <FillSection
        questionnaire={{
          ...mockQuestionnaire,
          description: '',
        }}
        token="test-token"
        theme={theme}
        onCompleted={noop}
        displayMode="form"
      />
    )

    expect(screen.getByText('Test Questionnaire')).toBeInTheDocument()
    // Empty description should not appear anywhere
    const descriptionElement = screen.queryByText('This is a test description')
    expect(descriptionElement).not.toBeInTheDocument()
  })

  it('applies muted text color to the description', () => {
    render(
      <FillSection
        questionnaire={mockQuestionnaire}
        token="test-token"
        theme={theme}
        onCompleted={noop}
        displayMode="form"
      />
    )

    const descriptionElement = screen.getByText('This is a test description')
    expect(descriptionElement).toHaveStyle(`color: ${theme.mutedColor}`)
  })
})
