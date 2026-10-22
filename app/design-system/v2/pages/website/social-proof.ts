import type { StackPerson } from '@/components/ui-v2/avatar-stack';

/**
 * The hero's social proof: five founding members' faces in an
 * `AvatarStack`, beside one line of how much they have run between them.
 * No "+N" bubble (founder, 2026-10-18): a count of the rest read as a
 * waitlist number, not proof.
 *
 * DEMO CONTENT. The names and the count are placeholders from the
 * founder brief (2026-10-17), not real members. Before this page goes
 * live: put five real founding members here, each with their photo in
 * `public/founding/` (`src: '/founding/jess.jpg'`) and their permission
 * to show it. A made-up face on a live page is a false claim; leave the
 * stack out rather than guess. Until then the circles show initials.
 *
 * @module app/design-system/v2/pages/website/social-proof
 */

/** PLACEHOLDER: five founding members, with photos once they are given. */
export const PROOF_MEMBERS: readonly StackPerson[] = [
  { name: 'Jess Taylor' },
  { name: 'Sam Lee' },
  { name: 'Priya Shah' },
  { name: 'Tom Ward' },
  { name: 'Ava Brooks' },
];

/**
 * How many weddings and events the founding members have run between
 * them, from the founder (2026-10-17). Keep it true and round it down
 * as the list changes.
 */
export const WEDDINGS_BEHIND = '10,000+';

