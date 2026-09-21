'use client'

/**
 * "Send at": a clock time on the 15-minute grid, or start of day.
 *
 * Rendered only when `supportsSendTime` (see `./timing-units`) says the
 * timing can carry one; the parent decides. The sentinel option stands in
 * for "no time" because the shared Select cannot represent an empty value.
 *
 * @module app/(dashboard)/workflows/[id]/send-time-select
 */

import { Select } from '@/components/ui/select'
import type { StepTiming } from '@/types/workflows'

import { NO_SEND_TIME, SEND_TIME_OPTIONS, withSendTime } from './timing-units'

/** Props for {@link SendTimeSelect}: the whole timing, so the helper can strip or set the key. */
export interface SendTimeSelectProps {
  value: StepTiming
  onChange: (next: StepTiming) => void
}

/** The "Send at" clock-time select. See {@link SendTimeSelectProps}. */
export function SendTimeSelect({ value, onChange }: SendTimeSelectProps) {
  const current = value.mode !== 'after_previous' && value.sendTime ? value.sendTime : NO_SEND_TIME
  return (
    <Select
      ariaLabel="Send at"
      value={current}
      options={SEND_TIME_OPTIONS}
      onValueChange={(next) => onChange(withSendTime(value, next === NO_SEND_TIME ? null : next))}
      className="w-36"
    />
  )
}
