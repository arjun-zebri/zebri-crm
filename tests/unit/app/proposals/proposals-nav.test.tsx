/**
 * The Proposals feature's segmented nav (spec D7, §5.1): four tabs when
 * the v2 flag is on, the current one selected; only "Proposals" when off.
 *
 * @module tests/unit/app/proposals/proposals-nav
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProposalsNav } from '@/app/(dashboard)/proposals/proposals-nav'

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe('ProposalsNav', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('shows the four tabs with the active one selected when the flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_PROPOSAL_LAYOUT_V2', '1')
    render(<ProposalsNav active="templates" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Proposals', 'Templates', 'Analytics', 'Settings'])
    expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('href', '/proposals/templates')
  })

  it('renders nothing when the flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_PROPOSAL_LAYOUT_V2', '')
    const { container } = render(<ProposalsNav active="proposals" />)
    expect(container).toBeEmptyDOMElement()
  })
})
