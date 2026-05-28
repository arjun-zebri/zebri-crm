import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

/**
 * Smoke test for the Badge primitive — also proves the unit project's
 * jsdom + React Testing Library + JSX pipeline works end to end.
 */
describe('<Badge />', () => {
  it('renders its children', () => {
    render(<Badge variant="default">Confirmed</Badge>)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('applies variant styles', () => {
    render(<Badge variant="paid">Paid</Badge>)
    const el = screen.getByText('Paid')
    expect(el.className).toContain('bg-emerald-50')
    expect(el.className).toContain('text-emerald-700')
  })

  it('merges a custom className', () => {
    render(
      <Badge variant="new" className="custom-x">
        New
      </Badge>,
    )
    expect(screen.getByText('New').className).toContain('custom-x')
  })
})
