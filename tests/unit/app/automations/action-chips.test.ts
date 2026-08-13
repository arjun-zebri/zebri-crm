/**
 * Action step chips, checked against the runner-side schemas — the
 * step equivalent of the trigger defs test. Every value a chip can
 * write must parse, or the run fails with a config error at execution
 * time instead of a validation message at build time.
 */
import { describe, expect, it } from 'vitest'

import {
  EMAIL_OPTION_CHIPS,
  TASK_STATUS_CHIP,
  taskDueChip,
} from '@/app/(dashboard)/automations/[id]/action-chips'
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

  it('removing the due chip clears both storage shapes', () => {
    const chip = taskDueChip(true)
    const removed = chip.remove({ dueDate: '2027-01-01', relativeToEvent: { amount: 7 } })
    expect(chip.isActive(removed)).toBe(false)
  })
})
