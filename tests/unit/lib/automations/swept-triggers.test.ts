/**
 * Narrowing for the triggers migrated in the 2026-08-13 sweep:
 * contracts, events, calendar offsets, portal, tasks and contacts.
 *
 * Each block pins the same two contracts: every filter the chip row
 * offers narrows against a real payload field, and configs saved
 * against the deleted Phase 14a fields still parse (passthrough), so
 * no existing automation is disabled by the sweep.
 */
import { describe, expect, it } from 'vitest'

import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function event(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

describe('contract triggers', () => {
  const types = [
    'contract_created',
    'contract_sent',
    'contract_signed',
    'contract_declined',
    'contract_expired',
  ] as const

  it.each(types)('%s narrows on the wedding date', (type) => {
    const spec = triggerRegistry[type]
    // 2027-03-06 is a Saturday in peak season.
    const march = event({ event_date: '2027-03-06' })
    expect(spec.match(march, {})).toBe(true)
    expect(spec.match(march, { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'dec' })).toBe(false)
    expect(spec.match(march, { season: 'peak' })).toBe(true)
    expect(spec.match(march, { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(event({ event_date: null }), { eventMonth: 'mar' })).toBe(false)
  })

  it('still parses configs saved with the deleted scaffolding fields', () => {
    const legacy = { templateUsed: 'x', versionNumber: 2, signerRole: 'both', signedByBoth: true }
    expect(triggerRegistry.contract_signed.configSchema.safeParse(legacy).success).toBe(true)
  })
})

describe('event_created / event_updated', () => {
  it('narrows on the event row date and venue', () => {
    const spec = triggerRegistry.event_created
    const payload = { date: '2027-03-06', venue: 'Curzon Hall' }
    expect(spec.match(event(payload), { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(event(payload), { season: 'off' })).toBe(false)
    expect(spec.match(event(payload), { hasVenue: true })).toBe(true)
    expect(spec.match(event({ date: '2027-03-06', venue: '' }), { hasVenue: true })).toBe(false)
    expect(spec.match(event({ date: '2027-03-06', venue: null }), { hasVenue: false })).toBe(true)
  })

  it('event_updated narrows on which field changed', () => {
    const spec = triggerRegistry.event_updated
    const dateMove = { date: '2027-04-10', prev_date: '2027-03-06', venue: 'A', prev_venue: 'A' }
    expect(spec.match(event(dateMove), { changed: 'date' })).toBe(true)
    expect(spec.match(event(dateMove), { changed: 'venue' })).toBe(false)
    expect(spec.match(event(dateMove), { changed: 'any' })).toBe(true)
  })

  it('ignores a legacy eventType (the app never writes one)', () => {
    const spec = triggerRegistry.event_created
    expect(spec.match(event({ date: '2027-03-06', event_type: 'ceremony' }), { eventType: 'rehearsal' })).toBe(true)
    expect(spec.configSchema.safeParse({ eventType: 'rehearsal', guestCountValue: 100 }).success).toBe(true)
  })
})

describe('calendar offsets', () => {
  it('time_before_event narrows on the event date buckets', () => {
    const spec = triggerRegistry.time_before_event
    const payload = { days_before: 14, date: '2027-03-06' }
    expect(spec.match(event(payload), { amount: 14, unit: 'days' })).toBe(true)
    expect(spec.match(event(payload), { amount: 14, unit: 'days', season: 'peak' })).toBe(true)
    expect(spec.match(event(payload), { amount: 14, unit: 'days', season: 'off' })).toBe(false)
    expect(spec.match(event(payload), { amount: 7, unit: 'days' })).toBe(false)
  })

  it('anniversary_of_event no longer accepts the onlyIf fields as declared config', () => {
    const spec = triggerRegistry.anniversary_of_event
    // Passthrough keeps them parsing, but the matcher never reads them.
    expect(spec.configSchema.safeParse({ years: 1, onlyIfMarriedByMe: true }).success).toBe(true)
    expect(spec.match(event({ years_since: 1 }), { years: 1 })).toBe(true)
  })
})

describe('portal triggers', () => {
  it('section_completed is labelled for what it does, not what it was called', () => {
    // It is an AFTER INSERT emitter on the portal tables — seven song
    // slots fire it seven times — so the old "Portal section
    // completed" label promised a completion signal it never sent.
    // The type string stays put so saved automations still resolve.
    const spec = triggerRegistry.section_completed
    expect(spec.type).toBe('section_completed')
    expect(spec.ui.label).toBe('Portal item added')
    expect(spec.ui.label).not.toMatch(/completed/i)
  })

  it('section_completed narrows on section, with "" as no narrowing', () => {
    const spec = triggerRegistry.section_completed
    expect(spec.match(event({ section: 'songs' }), { section: 'songs' })).toBe(true)
    expect(spec.match(event({ section: 'people' }), { section: 'songs' })).toBe(false)
    expect(spec.match(event({ section: 'people' }), { section: '' })).toBe(true)
  })

  it('timeline_edited distinguishes added from changed', () => {
    const spec = triggerRegistry.timeline_edited
    expect(spec.match(event({ op: 'INSERT' }), { change: 'added' })).toBe(true)
    expect(spec.match(event({ op: 'UPDATE' }), { change: 'added' })).toBe(false)
    expect(spec.match(event({ op: 'UPDATE' }), { change: 'changed' })).toBe(true)
    expect(spec.match(event({ op: 'INSERT' }), { change: 'any' })).toBe(true)
    expect(spec.match(event({ op: 'INSERT' }), {})).toBe(true)
  })

  it('section_completed carries the sub-filters folded in from the two duplicates', () => {
    const spec = triggerRegistry.section_completed
    const mb = 1024 * 1024

    // Files: size, from couple_uploaded_file.
    const bigFile = event({ section: 'files', file_size: 30 * mb })
    expect(spec.match(bigFile, { section: 'files', sizeBytesOp: 'gte', sizeBytesValue: 25 * mb })).toBe(true)
    expect(spec.match(event({ section: 'files', file_size: 10 * mb }), {
      section: 'files', sizeBytesOp: 'gte', sizeBytesValue: 25 * mb,
    })).toBe(false)

    // Songs: the portal slot, from couple_added_song_to_playlist.
    const song = event({ section: 'songs', category: 'first_dance' })
    expect(spec.match(song, { section: 'songs', songCategory: 'first_dance' })).toBe(true)
    expect(spec.match(song, { section: 'songs', songCategory: 'reception' })).toBe(false)

    // People: the person type, which no trigger offered before.
    const person = event({ section: 'people', category: 'bridal_party' })
    expect(spec.match(person, { section: 'people', personType: 'bridal_party' })).toBe(true)
    expect(spec.match(person, { section: 'people', personType: 'family' })).toBe(false)
  })

  it('ignores a sub-filter left over from another section', () => {
    // Switching the section chip hides the old sub-filter but leaves
    // its keys in the config. Enforcing a stale file-size rule against
    // a people event — which carries no file_size — would fail every
    // time and leave an automation that never runs.
    const spec = triggerRegistry.section_completed
    const person = event({ section: 'people', category: 'family' })
    expect(spec.match(person, { section: 'people', sizeBytesOp: 'gte', sizeBytesValue: 1 })).toBe(true)
    expect(spec.match(person, { section: 'people', songCategory: 'first_dance' })).toBe(true)
    // With no section at all the sub-filters are unreachable in the UI.
    expect(spec.match(person, { songCategory: 'family' })).toBe(true)
    expect(spec.match(person, { sizeBytesOp: 'gte', sizeBytesValue: 1 })).toBe(true)
  })

  it('does not let a song-slot filter read a person type', () => {
    // Both sections stamp `category`, so the scoping is load-bearing.
    const spec = triggerRegistry.section_completed
    const person = event({ section: 'people', category: 'family' })
    expect(spec.match(person, { section: 'songs', songCategory: 'family' })).toBe(false)
  })

  it('keeps the folded-in triggers matching for saved automations', () => {
    // They left the picker, not the registry — their emitters still
    // fire, so an automation already on one keeps working.
    const mb = 1024 * 1024
    expect(triggerRegistry.couple_uploaded_file.match(
      event({ file_size: 30 * mb }), { sizeBytesOp: 'gte', sizeBytesValue: 25 * mb },
    )).toBe(true)
    expect(triggerRegistry.couple_added_song_to_playlist.match(
      event({ category: 'first_dance' }), { category: 'first_dance' },
    )).toBe(true)
  })

  it('questionnaire_completed treats "" as any template', () => {
    const spec = triggerRegistry.questionnaire_completed
    expect(spec.match(event({ template_id: 'abc' }), { questionnaireTemplateId: '' })).toBe(true)
    expect(spec.configSchema.safeParse({ questionnaireTemplateId: '' }).success).toBe(true)
  })
})

describe('task triggers', () => {
  it('task_created narrows on the MC option names and the due date', () => {
    const spec = triggerRegistry.task_created
    const payload = { priority: 'Urgent', task_type: 'Ceremony', due_date: null }
    expect(spec.match(event(payload), { taskPriority: 'Urgent' })).toBe(true)
    expect(spec.match(event(payload), { taskPriority: 'Low' })).toBe(false)
    expect(spec.match(event(payload), { taskType: 'Ceremony' })).toBe(true)
    expect(spec.match(event(payload), { hasDueDate: false })).toBe(true)
    expect(spec.match(event(payload), { hasDueDate: true })).toBe(false)
  })

  it('task_overdue narrows on depth plus the option names', () => {
    const spec = triggerRegistry.task_overdue
    const payload = { days_overdue: 3, priority: 'High', task_type: 'Admin' }
    expect(spec.match(event(payload), { daysOverdueMin: 3, taskPriority: 'High' })).toBe(true)
    expect(spec.match(event(payload), { daysOverdueMin: 3, taskPriority: 'Low' })).toBe(false)
    expect(spec.configSchema.safeParse({ daysOverdueMin: 3, assignedTo: 'self' }).success).toBe(true)
  })
})

describe('contact triggers', () => {
  it('contact_created narrows on category, email and phone', () => {
    const spec = triggerRegistry.contact_created
    const payload = { category: 'photographer', email: 'a@b.co', phone: null }
    expect(spec.match(event(payload), { category: 'photographer' })).toBe(true)
    expect(spec.match(event(payload), { category: 'dj' })).toBe(false)
    expect(spec.match(event(payload), { hasEmail: true })).toBe(true)
    expect(spec.match(event(payload), { hasPhone: true })).toBe(false)
    expect(spec.match(event(payload), { hasPhone: false })).toBe(true)
  })

  it('contact_linked_to_couple narrows on category only', () => {
    const spec = triggerRegistry.contact_linked_to_couple
    expect(spec.match(event({ category: 'venue' }), { category: 'venue' })).toBe(true)
    expect(spec.match(event({ category: 'venue' }), { category: 'dj' })).toBe(false)
    expect(spec.match(event({ category: 'venue' }), { category: '' })).toBe(true)
  })

  it('still parses configs saved with the deleted fields', () => {
    const legacy = { category: 'venue', isPrimaryVendorForCouple: true, region: 'NSW' }
    expect(triggerRegistry.contact_created.configSchema.safeParse(legacy).success).toBe(true)
  })
})
