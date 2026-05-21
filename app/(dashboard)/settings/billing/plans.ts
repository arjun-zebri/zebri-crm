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
