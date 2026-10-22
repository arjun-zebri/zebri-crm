import { FONT_IDS, FONT_LABELS, FONT_STACKS } from '@/lib/branding/fonts';

/**
 * Static option lists for the onboarding demo: fonts and plans (Pro
 * includes Journeys, the one automation screen). Copy matches the live flow on
 * `feature/onboarding`. Connections live in `connections.ts`.
 *
 * @module app/design-system/v2/pages/onboarding/demo-data
 */

/** A font label's CSS stack, for the live brand preview. */
export function fontStack(label: string): string {
  const id = FONT_IDS.find((f) => FONT_LABELS[f] === label);
  return id ? FONT_STACKS[id] : 'ui-sans-serif, system-ui, sans-serif';
}

/** Font labels in catalogue order, from the real branding catalogue. */
export const FONTS: readonly string[] = FONT_IDS.map((id) => FONT_LABELS[id]);

/** The plans, cheapest first. */
export const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    pitch: 'A full season of events',
    price: 59,
    popular: true,
    highlights: ['Unlimited couples', 'Client portal', 'Questionnaires', 'Proposals', 'Templates', 'Journeys'],
  },
  {
    id: 'max',
    name: 'Max',
    pitch: 'Event day and a team',
    price: 99,
    highlights: [
      'Everything in Pro', 'SMS', 'Video calls', 'Talk to Zebri', 'Integrations',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pitch: 'Agencies and larger teams',
    price: null,
    highlights: ['Everything in Max', 'Pricing to fit your team'],
  },
] as const;

export type PlanId = (typeof PLANS)[number]['id'];
