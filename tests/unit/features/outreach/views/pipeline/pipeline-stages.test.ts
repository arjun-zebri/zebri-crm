/**
 * The Pipeline board and the prospect modal must read labels from one
 * map. This pins the shared source so the two cannot drift apart again.
 */
import { describe, expect, it } from 'vitest'

import { BOARD_STAGES, LOST_REASON_LABELS } from '@/features/outreach/views/pipeline/pipeline-stages'
import { LOST_REASON_LABELS as SHARED_LOST, STAGE_LABELS, stageLabel } from '@/features/outreach/views/prospects/labels'

describe('pipeline labels come from the shared prospects labels', () => {
  it('uses the same lost-reason map object', () => {
    expect(LOST_REASON_LABELS).toBe(SHARED_LOST)
  })

  it('names the CRM reason the same way the drawer does', () => {
    expect(LOST_REASON_LABELS.has_crm).toBe('Has a CRM')
  })

  it('labels every board column from the shared stage map', () => {
    for (const col of BOARD_STAGES) {
      expect(col.label).toBe(STAGE_LABELS[col.id as keyof typeof STAGE_LABELS])
    }
  })

  it('keeps the board in funnel order without new or opted-out', () => {
    expect(BOARD_STAGES.map((c) => c.id)).toEqual(['contacted', 'replied', 'demo_booked', 'demo_done', 'signed_up', 'paying', 'lost'])
  })

  it('falls back to a sentence-case label for an unknown stage code', () => {
    expect(stageLabel('some_new_stage')).toBe('Some new stage')
  })
})
