import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SidePanel } from '@/components/ui/side-panel'

describe('SidePanel', () => {
  it('names the dialog after its title', () => {
    render(
      <SidePanel isOpen onClose={vi.fn()} title="Priya Patel">
        body
      </SidePanel>,
    )
    expect(screen.getByRole('dialog', { name: 'Priya Patel' })).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <SidePanel isOpen={false} onClose={vi.fn()} title="Hidden">
        body
      </SidePanel>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
