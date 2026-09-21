import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { IntroNoteBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderIntroNote } from '@/lib/branding/public-blocks/proposal/intro-note'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({})
const block: IntroNoteBlock = { id: 'in', type: 'introNote', heading: 'A note from me' }

const noProposalDoc: PublicDocData = { title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }

describe('RenderIntroNote', () => {
  it('renders the resolved note HTML and heading', () => {
    render(
      <RenderIntroNote
        block={block}
        branding={branding}
        doc={SAMPLE_PROPOSAL_DOC}
        variableValues={{ couple_name: 'Anna & Jake' }}
      />,
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('A note from me')
    expect(screen.getByText(/Thank you for the call last week/)).toBeInTheDocument()
    expect(screen.getByText(/Anna & Jake/)).toBeInTheDocument()
  })

  it('renders null when doc.proposal is absent and no slot', () => {
    const { container } = render(<RenderIntroNote block={block} branding={branding} doc={noProposalDoc} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when the note is empty and no slot', () => {
    const emptyDoc: PublicDocData = {
      ...noProposalDoc,
      proposal: { ...SAMPLE_PROPOSAL_DOC.proposal!, introNote: null },
    }
    const { container } = render(<RenderIntroNote block={block} branding={branding} doc={emptyDoc} />)
    expect(container.firstChild).toBeNull()
  })

  it('caps the prose at the doc-prose token and centres the box when the note is centred', () => {
    const { container, rerender } = render(<RenderIntroNote block={block} branding={branding} doc={SAMPLE_PROPOSAL_DOC} />)
    expect(container.firstElementChild?.className).toContain('max-w-doc-prose')
    expect(container.firstElementChild?.className).not.toContain('mx-auto')
    rerender(<RenderIntroNote block={{ ...block, textStyle: { align: 'center' } }} branding={branding} doc={SAMPLE_PROPOSAL_DOC} />)
    expect(container.firstElementChild?.className).toContain('mx-auto')
    rerender(<RenderIntroNote block={{ ...block, textStyle: { align: 'right' } }} branding={branding} doc={SAMPLE_PROPOSAL_DOC} />)
    expect(container.firstElementChild?.className).toContain('ml-auto')
  })
})
