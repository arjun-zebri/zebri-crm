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
  is_starter: false,
  position: 0,
}

function setup() {
  render(
    <QuestionnaireBuilderModal
      template={template}
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
