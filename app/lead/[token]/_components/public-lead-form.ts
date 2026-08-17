/**
 * Types for the public lead-capture surface. `PublicLeadForm` is the
 * `get_lead_form` RPC payload (form flags + merged branding scalars).
 *
 * @module app/lead/[token]/_components/public-lead-form
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicBranding } from '@/lib/branding/public-branding';

/** Payload returned by `get_lead_form(token)`; null means unavailable. */
export interface PublicLeadForm extends PublicBranding {
  enabled: boolean;
  business_name: string;
  /**
   * The saved `lead` surface block tree, or null when the MC has not customised
   * it. When present, the public page renders these blocks; when null, it falls
   * back to the fixed enquiry field set.
   */
  blocks: Block[] | null;
}

/** UI state machine for the public form page. */
export type PageState = 'loading' | 'ready' | 'unavailable';
