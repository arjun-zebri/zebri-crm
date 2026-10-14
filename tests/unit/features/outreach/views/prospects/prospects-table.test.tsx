/**
 * The prospect name is the keyboard route into the drawer, since the row
 * click is mouse-only. These tests pin that the name is a real button and
 * that opening from it does not also fire the row handler.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProspectsTable } from '@/features/outreach/views/prospects/prospects-table'
import type { ProspectRow } from '@/lib/outreach/services/queries'

function row(overrides: Partial<ProspectRow> = {}): ProspectRow {
  return {
    id: 'p1',
    full_name: 'Ada Lovelace',
    suburb: 'Bondi',
    state: 'NSW',
    activity_score: null,
    verdict: 'active',
    stage: 'new',
    email: null,
    email_check: 'unchecked',
    email_source: null,
    instagram_handle: null,
    ig_last_post_at: null,
    site_status: null,
    do_not_contact: false,
    ...overrides,
  } as unknown as ProspectRow
}

describe('ProspectsTable name access', () => {
  it('renders the name as a focusable button', () => {
    render(<ProspectsTable rows={[row()]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument()
  })

  it('opens the drawer once from the name button, not twice via the row', () => {
    const onOpen = vi.fn()
    render(<ProspectsTable rows={[row()]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('still opens the drawer when the row itself is clicked', () => {
    const onOpen = vi.fn()
    render(<ProspectsTable rows={[row()]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('Bondi, NSW'))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })
})

describe('ProspectsTable columns', () => {
  const noop = { selected: new Set<string>(), onToggle: vi.fn(), onToggleAll: vi.fn(), onOpen: vi.fn() }

  it('shows only Name, Status, Stage and Email; website, score and Instagram live in the modal', () => {
    render(<ProspectsTable rows={[row({ website: 'https://www.example.com.au/about', site_status: 'live' })]} {...noop} />)
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean)
    expect(headers).toEqual(['Name', 'Status', 'Stage', 'Email'])
    expect(screen.queryByText('example.com.au')).not.toBeInTheDocument()
  })
})
