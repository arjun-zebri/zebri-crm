import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { NotReadyPanel } from '@/app/(dashboard)/branding/not-ready-panel'
import type { SurfaceReadiness } from '@/lib/branding/readiness'

describe('NotReadyPanel', () => {
  it('renders nothing when ready and no issues', () => {
    const readiness: SurfaceReadiness = {
      ready: true,
      issues: [],
    }
    const { container } = render(<NotReadyPanel readiness={readiness} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders issue messages when issues are present', () => {
    const readiness: SurfaceReadiness = {
      ready: false,
      issues: [
        {
          kind: 'missing-required',
          message: 'Add a title to finish this proposal.',
        },
        {
          kind: 'account',
          message: 'Add your bank details in Settings.',
        },
      ],
    }
    render(<NotReadyPanel readiness={readiness} />)
    expect(screen.getByText('Add a title to finish this proposal.')).toBeInTheDocument()
    expect(screen.getByText('Add your bank details in Settings.')).toBeInTheDocument()
  })

  it('renders the panel even when ready=true if issues exist', () => {
    const readiness: SurfaceReadiness = {
      ready: true,
      issues: [
        {
          kind: 'account',
          message: 'Connect Stripe to accept card payments.',
        },
      ],
    }
    render(<NotReadyPanel readiness={readiness} />)
    expect(screen.getByText('Connect Stripe to accept card payments.')).toBeInTheDocument()
  })
})
