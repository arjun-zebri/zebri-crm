import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import { RenderAction } from '@/lib/branding/public-blocks/action'
import { RenderFooter } from '@/lib/branding/public-blocks/footer'
import { RenderLineItems } from '@/lib/branding/public-blocks/line-items'
import { RenderPaymentDetails } from '@/lib/branding/public-blocks/payment-details'
import { RenderText } from '@/lib/branding/public-blocks/text'

const branding = { density: 'cozy', corner_radius: 8, brand_color: '#111', surface_color: '#fff', text_color: '#111', muted_color: '#666', button_size: 'md', button_radius: 8, button_variant: 'fill', secondary_color: '#EEE', font_body: 'system-ui' } as never

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

describe('public line items block layout', () => {
  it('renders amount element with shrink-0 class', () => {
    const doc = {
      title: 'Invoice',
      refNumber: 'INV-001',
      expiresAt: '2026-12-31',
      items: [
        { id: '1', description: 'Service', amount: 100, unit_price: undefined, quantity: undefined },
      ],
      subtotal: 100,
      taxRate: 10,
      discountType: undefined,
      discountValue: 0,
    }

    const container = render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems', showHeader: true }}
        branding={branding}
        doc={doc}
      />,
    ).container

    const amountElement = container.querySelector('span.shrink-0.tabular-nums')
    expect(amountElement).toBeInTheDocument()
  })
})

describe('public payment details block layout', () => {
  it('renders rows with flex-col class on mobile', () => {
    const container = render(
      <RenderPaymentDetails
        block={{ id: 'pd', type: 'paymentDetails', heading: 'Bank details', accountName: '', bsb: '', accountNumber: '' }}
        branding={branding}
      />,
    ).container

    const flexColElement = container.querySelector('[class*="flex-col"]')
    expect(flexColElement).toBeInTheDocument()
  })
})

describe('public action block widths', () => {
  it('primary button has flex-1 class when primaryWidthPx is undefined', () => {
    const { container } = render(
      <RenderAction
        block={{ id: 'a', type: 'action', primary: 'Accept', secondary: null }}
        branding={branding}
        onPrimary={() => {}}
      />,
    )

    const buttons = container.querySelectorAll('button')
    const primaryButton = buttons[0] as HTMLButtonElement | undefined
    expect(primaryButton?.className).toContain('flex-1')
  })

  it('primary button carries maxWidth style when primaryWidthPx is set', () => {
    const { container } = render(
      <RenderAction
        block={{ id: 'a', type: 'action', primary: 'Accept', secondary: null, primaryWidthPx: 200 }}
        branding={branding}
        onPrimary={() => {}}
      />,
    )

    const buttons = container.querySelectorAll('button')
    const primaryButton = buttons[0] as HTMLButtonElement | undefined
    const style = primaryButton?.getAttribute('style')
    expect(style).toContain('max-width')
    expect(style).toContain('200')
  })

  it('secondary button has w-auto class when secondaryWidthPx is undefined', () => {
    const { container } = render(
      <RenderAction
        block={{ id: 'a', type: 'action', primary: 'Accept', secondary: 'Decline' }}
        branding={branding}
        onPrimary={() => {}}
        onSecondary={() => {}}
      />,
    )

    const buttons = container.querySelectorAll('button')
    const secondaryButton = buttons[1] as HTMLButtonElement | undefined
    expect(secondaryButton?.className).toContain('w-auto')
  })

  it('secondary button carries maxWidth style when secondaryWidthPx is set', () => {
    const { container } = render(
      <RenderAction
        block={{ id: 'a', type: 'action', primary: 'Accept', secondary: 'Decline', secondaryWidthPx: 150 }}
        branding={branding}
        onPrimary={() => {}}
        onSecondary={() => {}}
      />,
    )

    const buttons = container.querySelectorAll('button')
    const secondaryButton = buttons[1] as HTMLButtonElement | undefined
    const style = secondaryButton?.getAttribute('style')
    expect(style).toContain('max-width')
    expect(style).toContain('150')
  })

  it('container applies justify class based on buttonJustify', () => {
    const { container } = render(
      <RenderAction
        block={{ id: 'a', type: 'action', primary: 'Accept', secondary: null, buttonJustify: 'end' }}
        branding={branding}
        onPrimary={() => {}}
      />,
    )

    const wrapper = container.querySelector('[class*="flex-col"]')
    expect(wrapper?.className).toContain('justify-end')
  })
})
