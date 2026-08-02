import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'

import { BlockRenderer } from '@/app/(dashboard)/branding/blocks/block-renderer'
import { migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'
import { RenderQuestionnairePreview } from '@/app/(dashboard)/branding/blocks/render'
import type {
  Block,
  QuestionnaireOneAtATimeBlock,
  QuestionnaireAllOnePageBlock,
} from '@/app/(dashboard)/branding/blocks/types'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import type { BrandPreviewState } from '@/types/branding-preview'

/**
 * The questionnaire form style is now chosen by which of two marker blocks is
 * present, not a toggle. RenderQuestionnairePreview renders the fixed sample for
 * its block type (all-on-one-page vs one-at-a-time) with no mode toggle.
 */
describe('RenderQuestionnairePreview', () => {
  const allOnePageBlock: QuestionnaireAllOnePageBlock = {
    id: 'test-block-id',
    type: 'questionnaireAllOnePage',
    locked: true,
  }

  const oneAtATimeBlock: QuestionnaireOneAtATimeBlock = {
    id: 'test-block-id',
    type: 'questionnaireOneAtATime',
    locked: true,
  }

  const defaultState: BrandPreviewState = {
    logoUrl: '',
    faviconUrl: '',
    headerImageUrl: '',
    brandColor: '#111827',
    headingColor: '#111827',
    subheadingColor: '#6B7280',
    surfaceColor: '#FFFFFF',
    textColor: '#111827',
    secondaryColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    tagline: '',
    footerText: '',
    abn: '',
    showContactOnDocuments: false,
    fontHeading: 'poppins',
    fontBody: 'inter',
    fontWeight: 600,
    fontBodyWeight: 400,
    density: 'cozy',
    cornerRadius: 16,
    docPadding: 32,
    headingSize: 32,
    bodySize: 14,
    headingCase: 'none',
    bodyCase: 'none',
    subheadingSize: 14,
    subheadingWeight: 600,
    subheadingCase: 'uppercase',
    headingLetterSpacing: 0,
    bodyLineHeight: 1.5,
    linkColor: '#111827',
    buttonVariant: 'fill',
    buttonSize: 'md',
    buttonRadius: 8,
    sectionSpacing: 24,
    businessName: 'Test Business',
    phone: '',
    website: '',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
    pinterestUrl: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
  }

  it('renders the all-on-one-page layout for questionnaireAllOnePage', () => {
    render(<RenderQuestionnairePreview block={allOnePageBlock} state={defaultState} />)

    const formInputs = screen.getAllByPlaceholderText(/DD\/MM\/YYYY|Type your answer/)
    expect(formInputs.length).toBeGreaterThan(0)
    expect(screen.getByText(/all on one page/i)).toBeInTheDocument()
  })

  it('renders the one-at-a-time layout for questionnaireOneAtATime', () => {
    render(<RenderQuestionnairePreview block={oneAtATimeBlock} state={defaultState} />)

    expect(screen.getByText(/Question 1 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/one at a time/i)).toBeInTheDocument()
  })

  it('has no mode-toggle buttons (the block type is the choice)', () => {
    render(<RenderQuestionnairePreview block={allOnePageBlock} state={defaultState} />)

    // The old Form / One-at-a-time toggle buttons are gone.
    expect(screen.queryByRole('button', { name: /^form$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^one at a time$/i })).not.toBeInTheDocument()
  })

  it('applies the block question style and button colour to the sample', () => {
    render(
      <RenderQuestionnairePreview
        block={{ ...allOnePageBlock, questionStyle: { color: 'rgb(10, 20, 30)' }, buttonColor: 'rgb(200, 0, 0)' }}
        state={defaultState}
      />,
    )
    const label = screen.getAllByText('What is the date of your wedding?')[0] as HTMLElement
    expect(label.style.color).toBe('rgb(10, 20, 30)')
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit.style.background).toBe('rgb(200, 0, 0)')
  })

  it('renders the form sample in the full editor canvas after loading legacy data', () => {
    // Reproduce the editor load path: legacy questionnaireBody in stored data →
    // migrate + repair → BlockRenderer (BlockFrame → renderBlock → preview).
    const stored: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'qb', type: 'questionnaireBody', mode: 'form', locked: true } as unknown as Block,
    ]
    const blocks = repairBlocks('questionnaire', migrateBlocks(stored, 'questionnaire'))
    expect(blocks.map((b) => b.type)).toContain('questionnaireAllOnePage')

    const noop = () => {}
    render(
      <BlockRenderer
        blocks={blocks}
        setBlocks={noop}
        state={defaultState}
        surface="questionnaire"
        selectedBlockIds={[]}
        setSelectedBlockIds={noop}
        requestAddAfter={noop}
        updateBlock={noop}
        duplicateBlock={noop}
        deleteBlock={noop}
        resetBlock={noop}
      />,
    )

    // The questionnaire block must actually render its sample in the canvas.
    expect(screen.getByText('What is the date of your wedding?')).toBeInTheDocument()
  })
})
