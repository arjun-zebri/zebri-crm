import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RenderFooter } from '@/lib/branding/public-blocks/footer'
import { RenderText } from '@/lib/branding/public-blocks/text'

const branding = { density: 'cozy', corner_radius: 8, brand_color: '#111', surface_color: '#fff', text_color: '#111', muted_color: '#666' } as never

describe('public text block slots', () => {
  it('renders sanitized static text by default', () => {
    render(<RenderText block={{ id: 't', type: 'text', text: '<b>hi</b><script>x</script>' }} branding={branding} />)
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('renders the editor slot when provided', () => {
    render(
      <RenderText
        block={{ id: 't', type: 'text', text: 'ignored' }}
        branding={branding}
        slots={{ text: <span data-testid="live-editor" /> }}
      />,
    )
    expect(screen.getByTestId('live-editor')).toBeInTheDocument()
    expect(screen.queryByText('ignored')).toBeNull()
  })
})

describe('public footer block slots', () => {
  it('renders the editor slot even when closingNote is empty', () => {
    render(
      <RenderFooter
        block={{ id: 'f', type: 'footer', closingNote: '' }}
        branding={branding}
        slots={{ note: <span data-testid="live-footer-editor" /> }}
      />,
    )
    expect(screen.getByTestId('live-footer-editor')).toBeInTheDocument()
  })

  it('renders the editor slot even when closingNote is undefined', () => {
    render(
      <RenderFooter
        block={{ id: 'f', type: 'footer' }}
        branding={branding}
        slots={{ note: <span data-testid="live-footer-editor" /> }}
      />,
    )
    expect(screen.getByTestId('live-footer-editor')).toBeInTheDocument()
  })

  it('renders sanitized static closing note when no slot provided', () => {
    render(
      <RenderFooter
        block={{ id: 'f', type: 'footer', closingNote: '<b>thank you</b><script>x</script>' }}
        branding={branding}
      />,
    )
    expect(screen.getByText('thank you')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})
