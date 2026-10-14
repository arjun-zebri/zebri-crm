/**
 * Pipeline card: the drag handle is the only drag target and the only
 * `touch-none` element, so the name link stays scrollable on a phone and
 * keeps a single job (open the prospect).
 */
import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DraggableProspectCard } from '@/features/outreach/views/pipeline/prospect-card'
import type { ProspectRow } from '@/lib/outreach/services/queries'

const row = {
  id: 'p1', full_name: 'Ada Lovelace', state: 'NSW', suburb: 'Bondi', email: null, email_source: null, email_check: null,
  instagram_handle: null, instagram_source: null, website: null, verdict: null, verdict_reason: null, activity_score: 7,
  stage: 'contacted', do_not_contact: false, ig_last_post_at: null, ig_followers: null, site_status: null,
} as unknown as ProspectRow

describe('DraggableProspectCard', () => {
  it('puts drag listeners and touch-none on the grip handle only', () => {
    render(<DndContext><DraggableProspectCard row={row} onMoveTo={vi.fn()} /></DndContext>)
    const handle = screen.getByRole('button', { name: 'Move Ada Lovelace' })
    expect(handle).toHaveClass('touch-none')
    const link = screen.getByRole('link', { name: /Ada Lovelace/ })
    expect(link).toHaveAttribute('href', '/admin/outreach?view=prospects&board=1&prospect=p1')
    expect(link).not.toHaveClass('touch-none')
  })
})
