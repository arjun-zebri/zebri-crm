/**
 * Sample multi-package proposal options for editor previews.
 *
 * Used by the branding editor's package-block previews and the multi-package
 * preview so an MC designing the proposal layout sees a realistic three-package
 * comparison. Never used on a sent document — real proposals carry the couple's
 * actual packages.
 *
 * @module components/proposal/proposal-sample-data
 */
import type { PublicProposalOption } from '@/lib/payments/proposal-view'

/** Three sample packages (Essentials / Full Day / Legacy) for editor previews. */
export const PROPOSAL_SAMPLE_MULTI: PublicProposalOption[] = [
  {
    id: 'sample-essentials',
    title: 'The Essentials',
    description: 'A beautiful record of the day itself.',
    gst_inclusive: true,
    is_popular: false,
    subtotal: 1100,
    position: 0,
    items: [
      { id: 'e1', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 0 },
      { id: 'e2', description: 'Reception MC & run sheet', amount: 550, is_addon: false, default_included: false, position: 1 },
    ],
  },
  {
    id: 'sample-fullday',
    title: 'The Full Day',
    description: 'Ceremony and reception, start to finish.',
    gst_inclusive: true,
    is_popular: true,
    subtotal: 1450,
    position: 1,
    items: [
      { id: 'f1', description: 'Pre-wedding consultation', amount: 0, is_addon: false, default_included: false, position: 0 },
      { id: 'f2', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 1 },
      { id: 'f3', description: 'Reception MC & run sheet', amount: 900, is_addon: false, default_included: false, position: 2 },
      { id: 'f4', description: 'Rehearsal attendance', amount: 150, is_addon: true, default_included: true, position: 3 },
      { id: 'f5', description: 'After-party hosting', amount: 250, is_addon: true, default_included: false, position: 4 },
    ],
  },
  {
    id: 'sample-legacy',
    title: 'The Legacy',
    description: 'Everything, plus extended coverage.',
    gst_inclusive: true,
    is_popular: false,
    subtotal: 2400,
    position: 2,
    items: [
      { id: 'l1', description: 'Full-day hosting (12 hrs)', amount: 1800, is_addon: false, default_included: false, position: 0 },
      { id: 'l2', description: 'Rehearsal-dinner hosting', amount: 600, is_addon: false, default_included: false, position: 1 },
    ],
  },
]
