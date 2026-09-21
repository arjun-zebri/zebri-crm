/**
 * A deterministic sample proposal for the branding editor's canvas and the
 * `/branding/preview/proposal` route, so the MC designs against realistic
 * options, add-ons and a note. Never sent anywhere.
 *
 * @module lib/proposals/sample-proposal
 */
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import { buildPublicBranding, type PublicBranding } from '@/lib/branding/public-branding';

import { toPublicDoc, type PublicProposal } from './public-types';

/**
 * Build a deterministic two-option sample proposal from the given branding.
 * Options, add-ons and item ids never change between calls so snapshot-style
 * assertions in the editor and its tests stay stable.
 *
 * @param branding - The MC's resolved branding, spread onto the proposal
 *   (the shape a real `PublicProposal` extends `PublicBranding` with).
 */
export function sampleProposal(branding: PublicBranding): PublicProposal {
  return {
    ...branding,
    id: 'sample', title: 'Anna & Jake, your wedding', proposal_number: 'PR-014', status: 'sent', version: 1,
    intro_note: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'couple_name' } }, { type: 'text', text: ',' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Thank you for the call last week. Here is everything we talked about, with two ways I can be part of your day. Pick the one that feels right and I will hold the date.' }] },
      ],
    },
    hero_override: null, expires_at: '2026-12-01', expired: false, deposit_percent: 25,
    accepted_option_id: null, accepted_addon_selection: null, accepted_at: null, declined_at: null,
    couple_name: 'Anna & Jake', event_date: '2027-03-20', venue: 'Stones of the Yarra Valley',
    options: [
      {
        id: 'opt-1', position: 0, title: 'Reception MC', description: 'Hosting from the grand entrance to the last dance.',
        pricing_mode: 'itemised', fixed_price: null, gst_inclusive: true, weekend_loading_percent: null, is_popular: false, subtotal: 1650,
        items: [
          { id: 'i-1', description: 'Planning meeting and run sheet', note: null, amount: 250, quantity: 1, is_addon: false, default_included: true, position: 0 },
          { id: 'i-2', description: 'Reception hosting (5 hours)', note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
          { id: 'i-3', description: 'Extra hour', note: null, amount: 250, quantity: 1, is_addon: true, default_included: false, position: 2 },
          { id: 'i-4', description: 'Travel outside Melbourne', note: null, amount: 180, quantity: 1, is_addon: true, default_included: false, position: 3 },
        ],
      },
      {
        id: 'opt-2', position: 1, title: 'Full day', description: 'Ceremony and reception, one familiar voice all day.',
        pricing_mode: 'itemised', fixed_price: null, gst_inclusive: true, weekend_loading_percent: null, is_popular: true, subtotal: 2400,
        items: [
          { id: 'i-5', description: 'Ceremony hosting and coordination', note: null, amount: 750, quantity: 1, is_addon: false, default_included: true, position: 0 },
          { id: 'i-6', description: 'Reception hosting (6 hours)', note: null, amount: 1650, quantity: 1, is_addon: false, default_included: true, position: 1 },
          { id: 'i-7', description: 'Rehearsal attendance', note: null, amount: 300, quantity: 1, is_addon: true, default_included: true, position: 2 },
          { id: 'i-8', description: 'Travel outside Melbourne', note: null, amount: 180, quantity: 1, is_addon: true, default_included: false, position: 3 },
        ],
      },
    ],
    branding_blocks: null,
    // The editor canvas is never a live close session, so these stay empty
    // the same way the PDF print path does (see `to-public.ts`).
    pending_contract: null, invoice: null, stripe_connect_enabled: false,
  };
}

/**
 * The sample proposal rendered to `PublicDocData`, ready for the editor
 * canvas and the branding preview route. Built once at module load from a
 * default (untouched) branding, since the sample data itself never changes.
 */
export const SAMPLE_PROPOSAL_DOC: PublicDocData = toPublicDoc(sampleProposal(buildPublicBranding({})));
