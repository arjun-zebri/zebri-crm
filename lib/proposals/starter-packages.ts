/**
 * Two sample packages per role, inserted by `chooseProposalRoleAction` only
 * when the MC has no packages yet (spec 7.5). Shapes reuse the invoice
 * starter catalogue so the templates page understands them.
 *
 * @module lib/proposals/starter-packages
 */
import type { StarterLineItemSet } from '@/lib/payments/starter-line-item-templates'
import type { ProposalRole } from '@/lib/proposals/types'

/** Starter packages seeded on first proposal-role choice, two per role. */
export const PROPOSAL_STARTER_PACKAGES: Record<ProposalRole, readonly StarterLineItemSet[]> = {
  mc: [
    {
      name: 'Reception MC',
      subtitle: 'Hosting from the entrance to the last dance',
      items: [
        { description: 'Planning meeting and run sheet', amount: 250 },
        { description: 'Reception hosting (5 hours)', amount: 1400 },
      ],
    },
    {
      name: 'Full Day MC',
      subtitle: 'Ceremony and reception',
      items: [
        { description: 'Ceremony hosting and coordination', amount: 750 },
        { description: 'Reception hosting (6 hours)', amount: 1650 },
      ],
    },
  ],
  celebrant: [
    {
      name: 'Legals Only',
      subtitle: 'A short legal ceremony',
      items: [
        { description: 'NOIM and legal paperwork', amount: 250 },
        { description: 'Legal ceremony (20 minutes)', amount: 450 },
      ],
    },
    {
      name: 'Story Ceremony',
      subtitle: 'Written for you, rehearsed with you',
      items: [
        { description: 'NOIM and legal paperwork', amount: 250 },
        { description: 'Ceremony writing and two drafts', amount: 900 },
        { description: 'Rehearsal and ceremony', amount: 650 },
      ],
    },
  ],
  both: [
    {
      name: 'Ceremony and Reception',
      subtitle: 'One voice all day',
      items: [
        { description: 'NOIM and legal paperwork', amount: 250 },
        { description: 'Story ceremony and rehearsal', amount: 1300 },
        { description: 'Reception hosting (5 hours)', amount: 1400 },
      ],
    },
    {
      name: 'The Whole Day',
      subtitle: 'Ceremony, reception, and planning',
      items: [
        { description: 'NOIM and legal paperwork', amount: 250 },
        { description: 'Story ceremony and rehearsal', amount: 1300 },
        { description: 'Reception hosting (6 hours)', amount: 1650 },
        { description: 'Planning meetings (x2)', amount: 300 },
      ],
    },
  ],
}
