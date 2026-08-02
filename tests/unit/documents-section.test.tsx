/**
 * Unit tests for the DocumentsSection component.
 *
 * Tests the toggle functionality with armed-confirm pattern and ensures
 * the last enabled surface cannot be disabled.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DocumentsSection } from '@/app/(dashboard)/branding/documents-section'
import type { SurfaceTab } from '@/types/branding-preview'

describe('DocumentsSection', () => {
  it('renders all five surfaces with labels and descriptions', () => {
    const handleToggle = vi.fn()
    const enabledSurfaces: SurfaceTab[] = ['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire']

    render(<DocumentsSection enabledSurfaces={enabledSurfaces} onToggleSurface={handleToggle} />)

    expect(screen.getByText('Invoices')).toBeInTheDocument()
    expect(screen.getByText('Contracts')).toBeInTheDocument()
    expect(screen.getByText('Client portal')).toBeInTheDocument()
    expect(screen.getByText('Run sheet')).toBeInTheDocument()
    expect(screen.getByText('Questionnaires')).toBeInTheDocument()

    expect(screen.getByText('Card and bank-transfer payments')).toBeInTheDocument()
    expect(screen.getByText('E-sign agreements')).toBeInTheDocument()
    expect(screen.getByText('The couple\'s home for everything')).toBeInTheDocument()
    expect(screen.getByText('Vendor-facing day-of timeline')).toBeInTheDocument()
    expect(screen.getByText('Collect details from couples')).toBeInTheDocument()
  })

  it('calls onToggleSurface with enabled=true when enabling a disabled surface', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()
    const enabledSurfaces: SurfaceTab[] = ['invoice', 'contract', 'portal']

    render(<DocumentsSection enabledSurfaces={enabledSurfaces} onToggleSurface={handleToggle} />)

    const vendorTimelineToggle = screen.getAllByRole('button').find((btn) => btn.textContent?.includes('Run sheet'))
    await user.click(vendorTimelineToggle!)

    expect(handleToggle).toHaveBeenCalledWith('vendorTimeline', true)
  })

  it('uses armed-confirm pattern when disabling: first click arms, second confirms', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()
    const enabledSurfaces: SurfaceTab[] = ['invoice', 'contract', 'portal', 'questionnaire', 'vendorTimeline']

    render(<DocumentsSection enabledSurfaces={enabledSurfaces} onToggleSurface={handleToggle} />)

    const vendorTimelineToggle = screen.getAllByRole('button').find((btn) => btn.textContent?.includes('Run sheet'))
    expect(vendorTimelineToggle).toBeInTheDocument()

    // First click should arm the button (not call handleToggle)
    await user.click(vendorTimelineToggle!)
    expect(handleToggle).not.toHaveBeenCalled()

    // Verify the confirmation text appears
    expect(screen.getByText('Hide and clear this design?')).toBeInTheDocument()

    // Second click should call handleToggle with false
    await user.click(vendorTimelineToggle!)
    expect(handleToggle).toHaveBeenCalledWith('vendorTimeline', false)
  })

  it('prevents disabling the last enabled surface', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()
    const enabledSurfaces: SurfaceTab[] = ['invoice']

    render(<DocumentsSection enabledSurfaces={enabledSurfaces} onToggleSurface={handleToggle} />)

    const invoiceToggle = screen.getAllByRole('button').find((btn) => btn.textContent?.includes('Invoices'))

    // Try to disable the only enabled surface
    await user.click(invoiceToggle!)
    expect(handleToggle).not.toHaveBeenCalled()

    // The button should be disabled
    expect(invoiceToggle).toHaveAttribute('disabled')
  })

  it('shows the enabled state with eye icon and disabled state with eye-off icon', () => {
    const handleToggle = vi.fn()
    const enabledSurfaces: SurfaceTab[] = ['invoice', 'contract']

    render(<DocumentsSection enabledSurfaces={enabledSurfaces} onToggleSurface={handleToggle} />)

    // Enabled surfaces should show the eye icon
    const invoicesCheckbox = screen.getByLabelText('Toggle Invoices')
    expect(invoicesCheckbox).toBeChecked()

    // Disabled surfaces should show the eye-off icon and no checkmark
    const vendorTimelineCheckbox = screen.getByLabelText('Toggle Run sheet')
    expect(vendorTimelineCheckbox).not.toBeChecked()
  })
})
