/**
 * The details step's form: inline validation, focus on the first problem,
 * phone modes, custom questions, and the payload it sends.
 *
 * @module tests/unit/app/book/booking-details-form
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BookingDetailsForm } from '@/app/book/[token]/booking-details-form'
import type { BookingQuestion, PhoneFieldMode } from '@/lib/booking/questions'

const venue: BookingQuestion = {
  id: 'venue',
  label: 'Venue type',
  type: 'single_choice',
  required: true,
  options: ['Garden', 'Ballroom'],
}

const partner: BookingQuestion = {
  id: 'partner',
  label: "Partner's name",
  type: 'short_text',
  required: false,
}

function renderForm(
  opts: { questions?: BookingQuestion[]; phoneField?: PhoneFieldMode; onSubmit?: ReturnType<typeof vi.fn> } = {},
) {
  const onSubmit = opts.onSubmit ?? vi.fn(async () => ({}))
  render(
    <BookingDetailsForm
      questions={opts.questions ?? []}
      phoneField={opts.phoneField ?? 'optional'}
      loading={false}
      onSubmit={onSubmit}
    />,
  )
  return { onSubmit }
}

describe('BookingDetailsForm', () => {
  it('renders the fields with Optional tags instead of "(optional)" in labels', () => {
    renderForm()

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Anything else we should know?')).toBeInTheDocument()
    expect(screen.getAllByText('Optional')).toHaveLength(2)
    expect(screen.queryByText(/\(optional\)/i)).not.toBeInTheDocument()
  })

  it('keeps the submit button enabled before anything is filled in', () => {
    renderForm()

    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeEnabled()
  })

  it('shows inline errors when submitted empty and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(screen.getByText('Enter your name')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a malformed email', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('clears a field error as soon as the field is edited', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(screen.getByText('Enter your name')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Full name'), 'A')
    expect(screen.queryByText('Enter your name')).not.toBeInTheDocument()
  })

  it('requires a phone number when the meeting type says so', async () => {
    const user = userEvent.setup()
    renderForm({ phoneField: 'required' })

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(screen.getByText(/enter a phone number/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toHaveFocus()
  })

  it('does not render the phone field at all when hidden', () => {
    renderForm({ phoneField: 'hidden' })

    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument()
  })

  it('submits without a phone number when optional and left blank', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ phoneField: 'optional' })

    await user.type(screen.getByLabelText('Full name'), '  Alice Smith  ')
    await user.type(screen.getByLabelText('Email'), ' alice@example.com ')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0]![0]
    expect(payload).toMatchObject({
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: undefined,
      notes: undefined,
      answers: [],
    })
    expect(typeof payload.startedAt).toBe('number')
  })

  it('makes a required custom question block submission and say so beside it', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ questions: [venue] })

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(screen.getByText('Choose an option')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Garden' })).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends the answers keyed by question id, in question order', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ questions: [venue, partner] })

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('radio', { name: 'Ballroom' }))
    await user.type(screen.getByLabelText("Partner's name"), 'Bob')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![0].answers).toEqual([
      { question_id: 'venue', value: 'Ballroom' },
      { question_id: 'partner', value: 'Bob' },
    ])
  })

  it('shows server field errors inline and focuses the field they belong to', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => ({ fieldErrors: { email: 'That email cannot be used for bookings' } }))
    renderForm({ onSubmit })

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(await screen.findByText('That email cannot be used for bookings')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('shows a form-level message that is not tied to one field', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => ({ formError: 'Check the details and try again.' }))
    renderForm({ onSubmit })

    await user.type(screen.getByLabelText('Full name'), 'Alice Smith')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the details and try again.')
  })
})
