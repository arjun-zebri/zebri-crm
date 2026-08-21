/**
 * Booking details form for the public booking page.
 *
 * Collects: name (required), partner name (optional), email (required), phone (optional),
 * notes (optional). Includes hidden honeypot (website) and timestamps form start for bot defense.
 * Matches the lead form's input styling idiom (uses Input primitive like lead does).
 *
 * @module app/book/[token]/booking-details-form
 */

'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { Slot } from './use-booking-page'

interface SubmitPayload {
  name: string
  partnerName: string | undefined
  email: string
  phone: string | undefined
  notes: string | undefined
}

export interface BookingDetailsFormProps {
  selectedSlot: Slot
  timezone: string
  loading: boolean
  onSubmit: (payload: SubmitPayload & { startedAt: number }) => void
}

/**
 * Form to capture details for the booking. Mint startedAt on mount for
 * bot defense (matches lead-form timing pattern).
 */
export function BookingDetailsForm({
  selectedSlot,
  timezone,
  loading,
  onSubmit,
}: BookingDetailsFormProps) {
  const startedAtRef = useRef(0)
  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  const [name, setName] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // honeypot

  const canSubmit = name.trim() !== '' && email.trim() !== '' && !loading

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const trimmedPartner = partnerName.trim()
    const trimmedPhone = phone.trim()
    const trimmedNotes = notes.trim()

    onSubmit({
      name: name.trim(),
      partnerName: trimmedPartner ? trimmedPartner : undefined,
      email: email.trim(),
      phone: trimmedPhone ? trimmedPhone : undefined,
      notes: trimmedNotes ? trimmedNotes : undefined,
      startedAt: startedAtRef.current,
    })
  }

  // Format selected time for display
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
  const selectedTimeStr = formatter.format(new Date(selectedSlot.start))

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Honeypot: hidden from humans, catnip for bots. Matches lead-form pattern. */}
      <div className="hidden" aria-hidden="true">
        <Input
          label=""
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="bg-surface-muted rounded-control p-4 mb-6">
        <p className="text-sm text-text-muted mb-1">Selected time</p>
        <p className="text-sm font-semibold text-text">{selectedTimeStr}</p>
      </div>

      <Input
        label="Your name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="First and last name"
      />

      <Input
        label="Partner's name (optional)"
        value={partnerName}
        onChange={(e) => setPartnerName(e.target.value)}
        placeholder="If applicable"
      />

      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
      />

      <Input
        label="Phone (optional)"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Include area code"
      />

      <Input
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything we should know?"
      />

      <Button
        type="submit"
        disabled={!canSubmit}
        loading={loading}
        className="w-full"
      >
        Confirm booking
      </Button>
    </form>
  )
}
