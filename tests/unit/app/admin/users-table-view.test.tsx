/**
 * Admin Users table (`app/(dashboard)/admin/sections/users-table-view`).
 *
 * The redesign contracts: Email and Status are no longer columns
 * (email stays searchable), Last sign-in and the value-metric columns
 * are, and rows order by plan tier (Max → Pro → Starter) with the
 * most recent sign-in first within a tier.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UsersTableView } from '@/app/(dashboard)/admin/sections/users-table-view'
import type { AdminUser } from '@/lib/admin/admin-analytics'
import { emptyUserStats, type UserStats } from '@/lib/admin/user-value'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

function user(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 'u1',
    email: 'mc@example.com',
    display_name: 'MC',
    business_name: 'MC Weddings',
    account_type: 'vendor',
    subscription_status: null,
    subscription_plan: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_end: null,
    subscription_end: null,
    cancel_at_period_end: false,
    is_subscribed: false,
    is_beta_user: false,
    is_comped: false,
    created_at: daysAgo(100),
    last_sign_in_at: null,
    last_seen_at: null,
    ...overrides,
  }
}

const USERS: AdminUser[] = [
  user({
    id: 'starter',
    display_name: 'Sam Starter',
    email: 'sam@example.com',
    last_sign_in_at: daysAgo(1),
    last_seen_at: null,
  }),
  user({
    id: 'max',
    display_name: 'Mia Max',
    email: 'mia@example.com',
    subscription_status: 'active',
    subscription_plan: 'max',
    stripe_subscription_id: 'sub_1',
    // Signed in a month ago but was on Zebri 2 days ago: the production
    // shape of a permanently-logged-in user.
    last_sign_in_at: daysAgo(30),
    last_seen_at: daysAgo(2),
  }),
  user({
    id: 'pro',
    display_name: 'Pat Pro',
    email: 'pat@example.com',
    subscription_status: 'active',
    subscription_plan: 'pro',
    stripe_subscription_id: 'sub_2',
    last_sign_in_at: daysAgo(2),
    last_seen_at: daysAgo(5),
  }),
]

const STATS: Record<string, UserStats> = {
  max: { couples: 12, events: 8, invoices: 5, paidTotal: 4300, templates: 3, automations: 2 },
}

function renderTable(onOpenUser = vi.fn()) {
  render(<UsersTableView users={USERS} stats={STATS} onOpenUser={onOpenUser} />)
  return onOpenUser
}

describe('UsersTableView', () => {
  it('shows the value-metric columns and drops Email and Status', () => {
    renderTable()
    for (const name of [
      'Name',
      'Business',
      'Plan',
      'Last seen',
      'Couples',
      'Events',
      'Invoices',
      'Templates',
      'Automations',
      'Signed up',
    ]) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('orders rows Max → Pro → Starter regardless of sign-in recency', () => {
    renderTable()
    const [, ...bodyRows] = screen.getAllByRole('row')
    const names = bodyRows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)
    expect(names).toEqual(['Mia Max', 'Pat Pro', 'Sam Starter'])
  })

  it('renders the stats and $ collected for a user, zeros for users without stats', () => {
    renderTable()
    const [, maxRow, , starterRow] = screen.getAllByRole('row')
    expect(maxRow).toHaveTextContent('$4,300')
    expect(maxRow).toHaveTextContent('12')
    const starterCells = within(starterRow!).getAllByRole('cell')
    // Couples / Events / Invoices / Templates / Automations all zero.
    expect(starterCells.map((c) => c.textContent).slice(4, 9)).toEqual(['0', '0', '0', '0', '0'])
    expect(emptyUserStats().paidTotal).toBe(0)
  })

  it('shows Last seen from last_seen_at, not last_sign_in_at', () => {
    renderTable()
    const [, maxRow, proRow, starterRow] = screen.getAllByRole('row')
    // Mia: sign-in 30d ago, but seen 2d ago -> the column must say 2d.
    expect(within(maxRow!).getAllByRole('cell')[3]).toHaveTextContent('2d ago')
    expect(within(proRow!).getAllByRole('cell')[3]).toHaveTextContent('5d ago')
    // Sam signed in yesterday but has no session activity at all.
    expect(within(starterRow!).getAllByRole('cell')[3]).toHaveTextContent('never')
  })

  it('still finds users by email through the search box', () => {
    renderTable()
    fireEvent.change(screen.getByPlaceholderText(/search by email/i), {
      target: { value: 'pat@example.com' },
    })
    const [, ...bodyRows] = screen.getAllByRole('row')
    expect(bodyRows).toHaveLength(1)
    expect(bodyRows[0]).toHaveTextContent('Pat Pro')
  })

  it('opens the detail panel when a row is clicked', () => {
    const onOpenUser = renderTable()
    fireEvent.click(screen.getByText('Mia Max'))
    expect(onOpenUser).toHaveBeenCalledWith('max')
  })
})
