import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { DEMO_GOLD } from '@/app/(dashboard)/branding/onboarding/demo-doc'
import { StepEditorDemo } from '@/app/(dashboard)/branding/onboarding/step-editor-demo'

describe('StepEditorDemo', () => {
  it('rests on the final frame under reduced motion', () => {
    render(<StepEditorDemo reducedMotion />)

    // The title-card overlay is faded out on the resting frame.
    expect(screen.getByTestId('demo-title-card')).toHaveAttribute('aria-hidden', 'true')

    // Chapter 1 happened: Run sheet was ticked on, its tab is in the strip.
    expect(screen.getByTestId('demo-tab-run-sheet')).toBeInTheDocument()

    // Chapter 2 happened: Typography ended up open with the picked font/size.
    expect(screen.getByTestId('demo-fonts-open')).toBeInTheDocument()
    expect(screen.getAllByText('Playfair Display').length).toBeGreaterThan(0)
    expect(screen.getByText('40px')).toBeInTheDocument()

    // Chapter 3 happened: the block got its individual colour and the
    // toolbar closed itself once the pick landed. The real action block
    // flips the label to white for the dark bronze via getTextColor.
    expect(screen.queryByTestId('demo-block-toolbar')).not.toBeInTheDocument()
    const accept = document.querySelector('[data-subtarget="primary"]')
    expect(accept).toHaveStyle({ background: DEMO_GOLD, color: '#ffffff' })

    // The canvas renders the real public document.
    expect(screen.getByText('Pay now')).toBeInTheDocument()
    expect(screen.getByText('Forever & Always')).toBeInTheDocument()
  })

  it('opens on the first title card when animating', () => {
    render(<StepEditorDemo reducedMotion={false} />)

    // The first chapter's title card covers the frame; nothing has played.
    expect(screen.getByText('Add or remove documents')).toBeInTheDocument()
    expect(screen.queryByTestId('demo-tab-run-sheet')).not.toBeInTheDocument()
    expect(screen.queryByTestId('demo-fonts-open')).not.toBeInTheDocument()
    expect(screen.queryByTestId('demo-block-toolbar')).not.toBeInTheDocument()
  })
})
