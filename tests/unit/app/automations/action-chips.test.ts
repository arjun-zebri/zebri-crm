/**
 * Action step chips, checked against the runner-side schemas — the
 * step equivalent of the trigger defs test. Every value a chip can
 * write must parse, or the run fails with a config error at execution
 * time instead of a validation message at build time.
 */
import { describe, expect, it } from 'vitest'

import {
  EMAIL_OPTION_CHIPS,
  TIMELINE_ITEM_CHIPS,
  RUN_SHEET_CHIP,
  TASK_STATUS_CHIP,
  taskDueChip,
} from '@/app/(dashboard)/automations/[id]/action-chips'
import { stepSummary } from '@/app/(dashboard)/automations/[id]/step-summary'
import { actionRegistry } from '@/lib/automations/actions'

describe('email option chips', () => {
  const schema = actionRegistry.send_email!.configSchema

  it('every option writes a config the send_email schema accepts', () => {
    const base = {
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      subject: 's',
      body: 'b',
    }
    for (const chip of EMAIL_OPTION_CHIPS) {
      const seeded = chip.add(base)
      expect(schema.safeParse(seeded).success, `${chip.key} default`).toBe(true)
      for (const option of chip.options ?? []) {
        const written = chip.apply!(seeded, option.value)
        expect(schema.safeParse(written).success, `${chip.key}=${option.value}`).toBe(true)
      }
    }
  })

  it('none are required — the email itself is the content', () => {
    for (const chip of EMAIL_OPTION_CHIPS) {
      expect(chip.required, chip.key).toBeUndefined()
    }
  })
})

describe('the run sheet audience chip', () => {
  const schema = actionRegistry.send_timeline_to_vendors!.configSchema

  it('reads as vendors for a config saved before the flags existed', () => {
    // The runner defaults `sendToVendors` to true, so a bare config
    // still goes to vendors — the chip has to say the same thing.
    expect(RUN_SHEET_CHIP.valueLabel({})).toBe('vendors')
    expect(schema.parse({ message: 'm' }).sendToVendors).toBe(true)
  })

  it('names every audience that is on', () => {
    expect(
      RUN_SHEET_CHIP.valueLabel({ sendToVendors: true, sendToCouple: true, sendToMe: true }),
    ).toBe('vendors, the couple, me')
  })

  it('says nobody when all three are off, rather than staying silent', () => {
    expect(RUN_SHEET_CHIP.valueLabel({ sendToVendors: false })).toBe('nobody')
  })

  it('is required, so the audience never leaves the card', () => {
    expect(RUN_SHEET_CHIP.required).toBe(true)
  })

  it('phrases the collapsed card the same way the chip does', () => {
    // Same helper behind both: a card and its chip disagreeing about
    // who gets the run sheet is worse than either being terse.
    const config = { sendToVendors: false, sendToCouple: true }
    const action = {
      id: 'a1',
      type: 'send_timeline_to_vendors',
      config,
      label: null,
    } as never
    expect(stepSummary(action)).toBe(`Sends the run sheet to ${RUN_SHEET_CHIP.valueLabel(config)}`)
  })
})

describe('timeline item chips', () => {
  const schema = actionRegistry.create_timeline_event!.configSchema
  const base = { title: 'Ceremony' }

  it('every chip seeds a config the runner accepts', () => {
    for (const chip of TIMELINE_ITEM_CHIPS) {
      const seeded = chip.add(base)
      expect(schema.safeParse(seeded).success, chip.key).toBe(true)
    }
  })

  it('reads as not set until a value is chosen', () => {
    // `startTime` seeds `''`, which the handler stores as null — the
    // chip has to say so rather than showing an empty value.
    const startTime = TIMELINE_ITEM_CHIPS.find((c) => c.key === 'startTime')!
    expect(startTime.valueLabel(startTime.add(base))).toBe('not set')
  })

  it('says the start time the way the clock is read aloud', () => {
    // Stored 24-hour (that is what the handler writes), shown
    // 12-hour, and the card says the same words.
    const startTime = TIMELINE_ITEM_CHIPS.find((c) => c.key === 'startTime')!
    expect(startTime.valueLabel({ startTime: '15:30' })).toBe('3:30 pm')
    expect(startTime.summary({ startTime: '15:30' })).toBe('Starts at 3:30 pm')
  })

  it('phrases a duration in minutes', () => {
    const duration = TIMELINE_ITEM_CHIPS.find((c) => c.key === 'durationMin')!
    expect(duration.valueLabel({ durationMin: 45 })).toBe('45 min')
    expect(duration.summary({ durationMin: 45 })).toBe('Runs for 45 min')
    // Zero is "not set", not "0 min": the handler stores null.
    expect(duration.valueLabel({ durationMin: 0 })).toBe('not set')
  })

  it('removing a chip clears the field it owned', () => {
    for (const chip of TIMELINE_ITEM_CHIPS) {
      const removed = chip.remove(chip.add(base))
      expect(chip.isActive(removed), chip.key).toBe(false)
      expect(schema.safeParse(removed).success, chip.key).toBe(true)
    }
  })
})

describe('task chips', () => {
  it('create_task due chip seeds a parseable relative default', () => {
    const schema = actionRegistry.create_task!.configSchema
    const seeded = taskDueChip(true).add({ title: 'Call the couple' })
    expect(schema.safeParse(seeded).success).toBe(true)
    expect(taskDueChip(true).summary(seeded)).toBe('Due 7 days before the event')
  })

  it('update_task chips parse against its schema', () => {
    const schema = actionRegistry.update_task!.configSchema
    const withStatus = TASK_STATUS_CHIP.apply!(TASK_STATUS_CHIP.add({}), 'in_progress')
    expect(schema.safeParse(withStatus).success).toBe(true)
    const withDue = taskDueChip(false).add({})
    expect(schema.safeParse({ ...withDue, dueDate: '2027-01-01' }).success).toBe(true)
  })

  it('keeps every relative-due value parseable', () => {
    // The popover writes amount, unit and direction separately, so
    // each partial write has to satisfy the runner's schema.
    const schema = actionRegistry.create_task!.configSchema
    const base = { title: 'Call the couple' }
    for (const relativeToEvent of [
      { direction: 'before', amount: 7, unit: 'days' },
      { direction: 'after', amount: 2, unit: 'weeks' },
      { direction: 'before', amount: 0, unit: 'days' },
    ]) {
      expect(schema.safeParse({ ...base, relativeToEvent }).success).toBe(true)
    }
    expect(taskDueChip(true).summary({ relativeToEvent: { direction: 'after', amount: 2, unit: 'weeks' } })).toBe(
      'Due 2 weeks after the event',
    )
  })

  it('removing the due chip clears both storage shapes', () => {
    const chip = taskDueChip(true)
    const removed = chip.remove({ dueDate: '2027-01-01', relativeToEvent: { amount: 7 } })
    expect(chip.isActive(removed)).toBe(false)
  })
})
