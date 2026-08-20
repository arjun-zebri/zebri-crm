/**
 * Tests for the couple profile's Package row.
 *
 * The row must always be present so the field is discoverable, must say
 * something true about why it is empty, and must save the package the MC
 * actually clicked.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import { CouplePackageSelector } from '@/app/(dashboard)/couples/couple-package-selector'
import type { PackageOption } from '@/app/(dashboard)/couples/use-packages'
import type { Couple } from '@/types/couple'

const PACKAGES: PackageOption[] = [
  { id: 'pkg-1', name: 'Ceremony only', description: null, gst_inclusive: true, total_amount: 900 },
  { id: 'pkg-2', name: 'Full day', description: null, gst_inclusive: true, total_amount: 1800 },
]

let available: PackageOption[] = PACKAGES

vi.mock('@/app/(dashboard)/couples/use-packages', async () => {
  const actual = await vi.importActual<typeof import('@/app/(dashboard)/couples/use-packages')>(
    '@/app/(dashboard)/couples/use-packages',
  )
  return {
    ...actual,
    usePackages: () => ({ data: available, isLoading: false }),
  }
})

const baseCouple: Couple = {
  id: 'couple-1',
  user_id: 'user-1',
  name: 'Jack and Jill',
  email: '',
  phone: '',
  event_date: null,
  venue: '',
  notes: '',
  status: 'new',
  lead_source: null,
  kanban_position: 0,
  created_at: '2026-01-01T00:00:00Z',
}

function setup(couple: Partial<Couple> = {}) {
  const onSelect = vi.fn()
  render(<CouplePackageSelector couple={{ ...baseCouple, ...couple }} onSelect={onSelect} />)
  return { onSelect }
}

beforeEach(() => {
  available = PACKAGES
})

describe('CouplePackageSelector', () => {
  it('always shows the Package row so the field is discoverable', () => {
    setup()
    expect(screen.getByText('Package')).toBeInTheDocument()
  })

  it('says none is selected when the MC has packages but has not chosen one', () => {
    setup()
    expect(screen.getByText('None selected')).toBeInTheDocument()
    expect(screen.queryByText('No packages yet')).not.toBeInTheDocument()
  })

  it('says there are no packages only when the MC has none', () => {
    available = []
    setup()
    expect(screen.getByText('No packages yet')).toBeInTheDocument()
  })

  it('shows the chosen package with its price', () => {
    setup({ selected_package_id: 'pkg-2' })
    expect(screen.getByText(/Full day/)).toBeInTheDocument()
    expect(screen.getByText(/1,800/)).toBeInTheDocument()
  })

  it('reports the package the MC clicked, not the previous selection', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByText('None selected'))
    await userEvent.click(await screen.findByRole('button', { name: /Full day/ }))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith('pkg-2')
  })

  it('reports null when None is chosen', async () => {
    const { onSelect } = setup({ selected_package_id: 'pkg-2' })
    await userEvent.click(screen.getByText(/Full day/))
    await userEvent.click(await screen.findByRole('button', { name: 'None' }))

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
