/**
 * Tests for the questionnaire builder modal: the "Couples answer"
 * display-mode toggle is gone (the public page derives the mode from
 * branding blocks), replaced by a read-only label showing the current
 * branding-derived mode plus a link into the branding editor.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { QuestionnaireBuilderModal } from '@/app/(dashboard)/templates/questionnaire-builder-modal'
import type { QuestionnaireTemplateRow } from '@/app/(dashboard)/templates/questionnaire-template-manager'

// Mock useCurrentBranding to avoid requiring a QueryClient. A real
// default-shaped PublicBranding keeps the preview renderers happy; empty
// blocks derive the default mode: all on one page.
vi.mock('@/lib/branding/use-current-branding', async () => {
  const { buildPublicBranding } = await vi.importActual<
    typeof import('@/lib/branding/public-branding')
  >('@/lib/branding/public-branding')
  return {
    useCurrentBranding: () => ({
      branding: buildPublicBranding({}),
      blocks: [],
      brandLabel: null,
      loading: false,
    }),
  }
})

// The "Send with" picker lists the MC's email templates; one active,
// one archived (which must not be offered).
vi.mock('@/app/(dashboard)/templates/use-templates', () => ({
  useTemplates: () => ({
    data: [
      { id: 'tpl-invite', name: 'Questionnaire invite', archived_at: null },
      { id: 'tpl-old', name: 'Old invite', archived_at: '2026-01-01' },
    ],
  }),
}))

const template: QuestionnaireTemplateRow = {
  id: 'test-id',
  name: 'Test Template',
  description: 'A test questionnaire',
  display_mode: 'form',
  questions: [
    {
      id: 'q1',
      type: 'short_text',
      label: 'Your name',
      required: false,
    },
  ],
  email_template_id: null,
  is_starter: false,
  position: 0,
}

function setup(over: Partial<QuestionnaireTemplateRow> = {}) {
  render(
    <QuestionnaireBuilderModal
      template={{ ...template, ...over }}
      saving={false}
      onCancel={() => {}}
      onSave={() => {}}
    />
  )
}

describe('QuestionnaireBuilderModal branding-derived mode', () => {
  it('shows the current branding-derived answer style read-only', () => {
    setup()
    expect(screen.getByText(/couples answer:/i)).toBeInTheDocument()
    expect(screen.getByText(/all on one page/i)).toBeInTheDocument()
  })

  it('links to the branding editor questionnaire surface', () => {
    setup()
    const link = screen.getByRole('link', { name: /change in branding/i })
    expect(link).toHaveAttribute('href', '/branding?surface=questionnaire')
  })

  it('no longer renders a display-mode toggle', () => {
    setup()
    expect(
      screen.queryByRole('button', { name: /one at a time/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: /one at a time/i })
    ).not.toBeInTheDocument()
  })
})

describe('QuestionnaireBuilderModal name variables and email', () => {
  it('previews a name variable with the sample couple, not the raw token', () => {
    setup({ name: "{{couple.primary_name | first}}'s Couples Questionnaire" })
    expect(screen.getAllByText("Sam's Couples Questionnaire").length).toBeGreaterThan(0)
    expect(screen.queryByText(/\{\{couple/)).not.toBeInTheDocument()
  })

  it('defaults "Send with" to the standard questionnaire email', () => {
    setup()
    expect(screen.getByText('Send with')).toBeInTheDocument()
    expect(screen.getByText('Standard questionnaire email')).toBeInTheDocument()
  })

  it('shows the chosen email template', () => {
    setup({ email_template_id: 'tpl-invite' })
    expect(screen.getByText('Questionnaire invite')).toBeInTheDocument()
  })
})
