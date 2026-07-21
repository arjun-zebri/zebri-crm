import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { PreviewFrame } from '@/app/(dashboard)/onboarding/previews/preview-frame'

describe('PreviewFrame', () => {
  it('renders the sidebar rail and its content', () => {
    render(
      <PreviewFrame activeNav="couples" navClicked>
        <div>content here</div>
      </PreviewFrame>,
    )
    expect(screen.getByText('Couples')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
    expect(screen.getByText('content here')).toBeInTheDocument()
  })

  it('marks the active nav item once clicked', () => {
    render(
      <PreviewFrame activeNav="automations" navClicked>
        <div />
      </PreviewFrame>,
    )
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'false')
  })

  it('leaves nothing active before the click beat', () => {
    render(
      <PreviewFrame activeNav="automations" navClicked={false}>
        <div />
      </PreviewFrame>,
    )
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'false')
  })
})
