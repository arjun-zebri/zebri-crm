import { FONT_IDS, FONT_LABELS, FONT_STACKS } from '@/lib/branding/fonts';

/**
 * Static option lists for the onboarding demo: fonts, workflow triggers
 * and actions, and plans. Copy matches the live flow on
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

/** Workflow triggers: label, description and the email subject each implies. */
export const TRIGGERS = [
  { id: 'enquiry', label: 'New enquiry', description: 'When a couple is added to your CRM', subject: 'Thanks for reaching out' },
  { id: 'deposit', label: 'Deposit paid', description: 'When a couple makes a payment', subject: 'Your date is locked in' },
  { id: 'two-weeks', label: '14 days before the wedding', description: 'Two weeks out from the event date', subject: 'Two weeks to go' },
] as const;

export type TriggerId = (typeof TRIGGERS)[number]['id'];

/** Workflow actions. `subtitle` null means "use the trigger's email subject". */
export const ACTIONS = [
  { id: 'wait', label: 'Wait', subtitle: '1 day later', who: 'zebri' },
  { id: 'email', label: 'Send email', subtitle: null, who: 'zebri' },
  { id: 'questionnaire', label: 'Send questionnaire', subtitle: 'Your starter questionnaire', who: 'zebri' },
  { id: 'contract', label: 'Send contract', subtitle: "The couple's contract, for signing", who: 'zebri' },
  { id: 'task', label: 'Create a task for me', subtitle: 'Call the couple', who: 'you' },
] as const;

export type ActionId = (typeof ACTIONS)[number]['id'];

/** Most steps a workflow can have here; the rest live on Workflows. */
export const MAX_WORKFLOW_STEPS = 6;

export const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    pitch: 'A full season of events',
    price: 59,
    popular: true,
    highlights: ['Unlimited couples', 'Client portal', 'Questionnaires', 'Proposals', 'Templates', 'Workflows'],
  },
  {
    id: 'max',
    name: 'Max',
    pitch: 'Event day and a team',
    price: 99,
    highlights: [
      'Everything in Pro', 'SMS', 'Video calls', 'Talk to Zebri', 'Email marketing', 'Integrations',
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
