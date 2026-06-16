/**
 * Narration tests for the couple Automations activity feed.
 *
 * `narrateAuditEntry` turns one `automation_audit_log` row into a
 * human sentence ("Sent email", "Moved couple to Booked") or `null`
 * when the event is internal noise the feed shouldn't surface. These
 * lock in the outcome-first wording, the silent-no-op detection
 * (an `action_completed` carrying `details.skipped`), and the
 * error/skip tones.
 */
import { describe, expect, it } from 'vitest'

import { narrateAuditEntry } from '@/lib/automations/audit-log/narrate'

describe('narrateAuditEntry', () => {
  it('narrates a completed send_email as a success', () => {
    const n = narrateAuditEntry({
      event: 'action_completed',
      actionType: 'send_email',
      actionLabel: null,
      details: { recipients: 1, sent: 1, failed: 0 },
    })
    expect(n).not.toBeNull()
    expect(n?.tone).toBe('success')
    expect(n?.text).toBe('Sent email')
  })

  it('flags a completed action that silently did nothing (skipped output)', () => {
    const n = narrateAuditEntry({
      event: 'action_completed',
      actionType: 'send_email',
      actionLabel: null,
      details: { skipped: 'no recipients' },
    })
    expect(n?.tone).toBe('warning')
    expect(n?.text).toMatch(/email/i)
    expect(n?.text).toMatch(/no recipients/i)
  })

  it('names the destination stage for update_couple_stage', () => {
    const n = narrateAuditEntry({
      event: 'action_completed',
      actionType: 'update_couple_stage',
      actionLabel: null,
      details: { from_status: 'Enquiry', to_status: 'Booked' },
    })
    expect(n?.text).toBe('Moved couple to Booked')
  })

  it('narrates create_task generically', () => {
    const n = narrateAuditEntry({
      event: 'action_completed',
      actionType: 'create_task',
      actionLabel: null,
      details: { task_id: 'abc' },
    })
    expect(n?.text).toBe('Created task')
    expect(n?.tone).toBe('success')
  })

  it('renders a failed action with the friendly error', () => {
    const n = narrateAuditEntry({
      event: 'action_errored',
      actionType: 'send_email',
      actionLabel: null,
      details: { message: 'unknown action send_smoke' },
    })
    expect(n?.tone).toBe('danger')
    expect(n?.text).toMatch(/not available yet/i)
  })

  it('narrates a disabled-step skip as neutral', () => {
    const n = narrateAuditEntry({
      event: 'action_skipped',
      actionType: 'send_sms',
      actionLabel: null,
      details: { reason: 'disabled' },
    })
    expect(n?.tone).toBe('neutral')
    expect(n?.text).toMatch(/skipped/i)
  })

  it('narrates a quiet-hours deferral as waiting', () => {
    const n = narrateAuditEntry({
      event: 'quiet_hours_deferred',
      actionType: 'send_email',
      actionLabel: null,
      details: { wake_at: '2026-06-22T08:00:00Z' },
    })
    expect(n?.tone).toBe('warning')
    expect(n?.text).toMatch(/quiet hours/i)
  })

  it('falls back to the step label for an unmapped action', () => {
    const n = narrateAuditEntry({
      event: 'action_completed',
      actionType: 'send_onboarding_pack',
      actionLabel: 'Welcome pack',
      details: {},
    })
    expect(n?.text).toBe('Ran “Welcome pack”')
  })

  it('returns null for internal noise events', () => {
    expect(
      narrateAuditEntry({ event: 'action_started', actionType: 'send_email', actionLabel: null, details: {} }),
    ).toBeNull()
    expect(
      narrateAuditEntry({ event: 'run_started', actionType: null, actionLabel: null, details: {} }),
    ).toBeNull()
  })
})
