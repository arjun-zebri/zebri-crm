/**
 * Plan catalogue — single source of truth for the Plans & Billing
 * tab. Each plan has a short tagline used in the compact "current
 * plan" card and a feature list used in the expandable comparison.
 *
 * @module app/(dashboard)/settings/billing/plans
 */

export type PlanId = 'starter' | 'pro' | 'max';

export interface PlanFeature {
  label: string;
  included: boolean;
  /** Tag the feature as "Soon" — included in the tier but not yet shipped. */
  soon?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Display price. `null` for the free tier. */
  price: string | null;
  /** "/mo", "/yr", …. Empty for free. */
  period: string;
  /** Short single-line summary used on the "current plan" card. */
  tagline: string;
  /** Feature matrix for the comparison view. */
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: null,
    period: '',
    tagline: 'For MCs getting started. CRM, quotes, invoices.',
    features: [
      { label: 'Up to 5 couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: false },
      { label: 'Song selection & file transfer', included: false },
      { label: 'Timeline Builder', included: false },
      { label: 'Pulse', included: false },
      { label: 'Event Mode', included: false },
      { label: 'Up to 5 team members', included: false },
      { label: 'Dedicated account manager & priority support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    tagline: 'Unlimited couples, portal, songs, and timeline.',
    features: [
      { label: 'Unlimited couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: true },
      { label: 'Song selection & file transfer', included: true },
      { label: 'Timeline Builder', included: true },
      { label: 'Pulse', included: false },
      { label: 'Event Mode', included: false },
      { label: 'Up to 5 team members', included: false },
      { label: 'Dedicated account manager & priority support', included: false },
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '$89',
    period: '/mo',
    tagline: 'Everything in Pro plus Pulse, Event Mode, and team.',
    features: [
      { label: 'Unlimited couples', included: true },
      { label: 'CRM & pipeline', included: true },
      { label: 'Quotes, invoices & payment links', included: true },
      { label: 'Task management', included: true },
      { label: 'Couple portal', included: true },
      { label: 'Song selection & file transfer', included: true },
      { label: 'Timeline Builder', included: true },
      { label: 'Pulse', included: true, soon: true },
      { label: 'Event Mode', included: true, soon: true },
      { label: 'Up to 5 team members', included: true, soon: true },
      { label: 'Dedicated account manager & priority support', included: true },
    ],
  },
];

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}

/**
 * The user-visible highlights for each tier — used inline on the
 * current-plan card to show "what you get" without expanding the
 * full comparison table.
 */
export const PLAN_HIGHLIGHTS: Record<PlanId, string[]> = {
  starter: [
    'Up to 5 couples',
    'CRM & pipeline',
    'Quotes, invoices & payments',
    'Task management',
  ],
  pro: [
    'Unlimited couples',
    'CRM & pipeline',
    'Couple portal',
    'Song selection & file transfer',
    'Timeline Builder',
    'Quotes, invoices & payments',
  ],
  max: [
    'Everything in Pro',
    'Pulse',
    'Event Mode',
    'Up to 5 team members',
    'Dedicated account manager',
  ],
};

/**
 * Row schema for the compact comparison table. Each cell is either
 * a string ("Free", "$49/mo", "5"), a boolean (rendered as ✓ / —),
 * or the literal `'soon'` for "included in this tier but not yet
 * shipped".
 */
export type ComparisonCell = string | boolean | 'soon';
export interface ComparisonRow {
  label: string;
  values: Record<PlanId, ComparisonCell>;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Price', values: { starter: 'Free', pro: '$49/mo', max: '$89/mo' } },
  { label: 'Couples', values: { starter: '5', pro: 'Unlimited', max: 'Unlimited' } },
  { label: 'CRM & pipeline', values: { starter: true, pro: true, max: true } },
  { label: 'Quotes, invoices & payments', values: { starter: true, pro: true, max: true } },
  { label: 'Task management', values: { starter: true, pro: true, max: true } },
  { label: 'Couple portal', values: { starter: false, pro: true, max: true } },
  { label: 'Song selection & files', values: { starter: false, pro: true, max: true } },
  { label: 'Timeline Builder', values: { starter: false, pro: true, max: true } },
  { label: 'Pulse', values: { starter: false, pro: false, max: 'soon' } },
  { label: 'Event Mode', values: { starter: false, pro: false, max: 'soon' } },
  { label: 'Team members', values: { starter: false, pro: false, max: 'Up to 5' } },
  { label: 'Priority support', values: { starter: false, pro: false, max: true } },
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatUnixDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
