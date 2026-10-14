/**
 * Phone filter collapse. Search is always visible; the other filters sit
 * behind a Filters toggle that counts how many are in use.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  countActiveFilters, DEFAULT_FILTERS, ProspectsFilters, type ProspectFilterState,
} from '@/features/outreach/views/prospects/prospects-filters'

describe('countActiveFilters', () => {
  it('is zero for the defaults', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
  })

  it('counts each narrowed select and checked box, not the search', () => {
    const value: ProspectFilterState = { ...DEFAULT_FILTERS, search: 'bondi', verdict: 'active', hasEmail: true, hasInstagram: true }
    expect(countActiveFilters(value)).toBe(3)
  })
})

describe('ProspectsFilters mobile toggle', () => {
  it('starts collapsed and expands on the Filters button', () => {
    render(<ProspectsFilters value={DEFAULT_FILTERS} onChange={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the active count on the toggle', () => {
    render(<ProspectsFilters value={{ ...DEFAULT_FILTERS, hasEmail: true, stage: 'paying' }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Filters 2' })).toBeInTheDocument()
  })

  it('keeps the search box visible while collapsed', () => {
    render(<ProspectsFilters value={DEFAULT_FILTERS} onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Search prospects' })).toBeVisible()
  })
})
