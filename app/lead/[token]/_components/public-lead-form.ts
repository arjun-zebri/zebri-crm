/**
 * Types for the public lead-capture surface. `PublicLeadForm` is the
 * `get_lead_form` RPC payload (form flags + merged branding scalars).
 *
 * @module app/lead/[token]/_components/public-lead-form
 */
import type { PublicBranding } from '@/lib/branding/public-branding';

/** Payload returned by `get_lead_form(token)`; null means unavailable. */
export interface PublicLeadForm extends PublicBranding {
  enabled: boolean;
  business_name: string;
}

/** UI state machine for the public form page. */
export type PageState = 'loading' | 'ready' | 'unavailable';
