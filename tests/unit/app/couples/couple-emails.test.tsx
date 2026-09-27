/**
 * The couple Emails tab (Task 30): automated sends show alongside manual
 * ones, each with the delivery status the Resend webhook keeps current,
 * and the tab keeps its empty and error states.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const result = vi.hoisted(() => ({
  current: { data: [] as unknown[] | null, error: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => result.current }),
      }),
    }),
  }),
}))

// The header's pickers and the compose modal read templates of their
// own; they are not what this file is about.
vi.mock('@/app/(dashboard)/couples/couple-template-picker', () => ({ CoupleTemplatePicker: () => null }))
vi.mock('@/app/(dashboard)/couples/couple-send-email', () => ({ CoupleSendEmail: () => null }))

import type { CoupleEmail } from '@/app/(dashboard)/couples/couple-email-row'
import { CoupleEmails } from '@/app/(dashboard)/couples/couple-emails'

function row(overrides: Partial<CoupleEmail>): CoupleEmail {
  return {
    id: crypto.randomUUID(),
    subject: 'Your wedding timeline',
    template_name: null,
    to_email: 'sam@example.com',
    source: 'automation',
    status: 'sent',
    sent_at: new Date().toISOString(),
    workflow_steps: null,
    transport: 'resend',
    error: null,
    superseded_at: null,
    ...overrides,
  }
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CoupleEmails coupleId="couple-1" coupleName="Sam & Alex" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  result.current = { data: [], error: null }
})

describe('CoupleEmails', () => {
  it('renders every delivery status with its own label', async () => {
    result.current = {
      data: [
        row({ status: 'sent', subject: 'One' }),
        row({ status: 'delivered', subject: 'Two' }),
        row({ status: 'bounced', subject: 'Three' }),
        row({ status: 'complained', subject: 'Four' }),
        row({ status: 'failed', subject: 'Five' }),
        row({ status: 'deferred', subject: 'Six' }),
      ],
      error: null,
    }
    renderTab()
    for (const label of ['Sent', 'Delivered', 'Bounced', 'Complained', 'Failed', 'Delayed']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    // Three of the six did not reach the inbox; the delayed one is its
    // own figure, not counted as sent.
    expect(screen.getByText('3 not delivered')).toBeInTheDocument()
    expect(screen.getByText('1 delayed')).toBeInTheDocument()
    expect(screen.getByText('2 sent')).toBeInTheDocument()
  })

  it("says a send from the MC's own mailbox is final and untracked, not awaiting word (I2)", async () => {
    result.current = {
      data: [row({ transport: 'gmail', subject: 'Via Gmail' }), row({ transport: 'graph', subject: 'Via Outlook' })],
      error: null,
    }
    renderTab()
    expect(await screen.findAllByText('Sent from your mailbox')).toHaveLength(2)
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
    expect(screen.getAllByText("Delivery isn't tracked for your own mailbox.")).toHaveLength(2)
    expect(screen.getByText('2 sent')).toBeInTheDocument()
  })

  it('shows why a failed send failed, in full, readable on touch (I2, R1)', async () => {
    const error = 'The domain app.zebri.com.au is not verified. Please add and verify it.'
    result.current = { data: [row({ status: 'failed', error })], error: null }
    renderTab()
    const reason = await screen.findByText(`Not sent: ${error}`)
    // A hover title never shows on a phone: the reason wraps in the row
    // instead of truncating behind one.
    expect(reason).not.toHaveClass('truncate')
    expect(reason).toHaveClass('break-words')
  })

  it('stacks the pill under the text below sm, so the subject keeps the width (R1)', async () => {
    result.current = { data: [row({ transport: 'gmail', subject: 'A long subject line' })], error: null }
    renderTab()
    const pillColumn = (await screen.findByText('Sent from your mailbox')).closest('[data-slot="email-row-status"]')
    expect(pillColumn).not.toBeNull()
    // A row on phones, the right-hand column from sm up.
    expect(pillColumn).toHaveClass('flex-row', 'sm:flex-col')
    expect(pillColumn).not.toHaveClass('shrink-0')
  })

  it('reads a failure a later send replaced as replaced, not undelivered (M4)', async () => {
    result.current = {
      data: [
        row({ status: 'failed', error: 'timeout', superseded_at: new Date().toISOString(), subject: 'Old' }),
        row({ status: 'delivered', subject: 'New' }),
      ],
      error: null,
    }
    renderTab()
    expect(await screen.findByText('Replaced by a later send')).toBeInTheDocument()
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    expect(screen.queryByText(/not delivered/)).not.toBeInTheDocument()
    expect(screen.getByText('1 sent')).toBeInTheDocument()
    // The total is what the figures add up to: a replaced row is history,
    // counted in none of them, so not in the total either.
    expect(screen.getByText('1 total')).toBeInTheDocument()
  })

  it('names the workflow step an automated send came from', async () => {
    result.current = {
      data: [row({ status: 'delivered', workflow_steps: { title: 'Welcome email' } })],
      error: null,
    }
    renderTab()
    expect(await screen.findByText(/Workflow: Welcome email · to sam@example.com/)).toBeInTheDocument()
  })

  it('shows a manual send by its template name', async () => {
    result.current = {
      data: [row({ source: 'manual', template_name: 'Thank you', subject: 'Thanks!' })],
      error: null,
    }
    renderTab()
    expect(await screen.findByText('Thank you')).toBeInTheDocument()
    expect(screen.getByText(/Thanks! · to sam@example.com/)).toBeInTheDocument()
  })

  it('shows the empty state when nothing has been sent', async () => {
    renderTab()
    expect(await screen.findByText('No emails sent yet')).toBeInTheDocument()
  })

  it('shows the error state when the read fails', async () => {
    result.current = { data: null, error: { message: 'boom' } }
    renderTab()
    expect(await screen.findByText("Couldn't load emails")).toBeInTheDocument()
  })
})
