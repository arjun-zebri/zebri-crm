/**
 * Branding Editor Redesign — Public Branding Fields Integration Test.
 *
 * Verifies that the new global typography and layout fields (from Task 0.3)
 * are correctly assembled by `_user_branding` and flow through the public
 * RPCs (`get_public_proposal`, `get_portal_data`).
 *
 * Runs against local Supabase with the real schema and RLS.
 */

import { afterAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

interface TestSetup {
  user: TestUser;
  coupleId: string;
  proposalId: string;
  proposalToken: string;
  portalToken: string;
}

/**
 * Provision a test user with custom branding values, a couple,
 * a proposal with share_token enabled, and a portal token.
 */
async function arrangeTest(): Promise<TestSetup> {
  // Create user with new branding fields set in metadata
  const user = await createTestUser(
    {
      heading_size: 44,
      body_size: 18,
      heading_case: 'uppercase',
      body_case: 'capitalize',
      heading_letter_spacing: 2,
      body_line_height: 1.8,
      link_color: '#FF0000',
      button_variant: 'outline',
      button_size: 'lg',
      button_radius: 12,
      section_spacing: 48,
      page_background: '#F5F5F5',
    },
    pro,
  );

  const admin = serviceClient();

  // Create couple
  const couple = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Test Couple', status: 'enquiry' })
    .select('id, portal_token')
    .single();
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`);
  }

  // Enable portal token
  await admin
    .from('couples')
    .update({ portal_token_enabled: true })
    .eq('id', couple.data.id);

  // Create proposal
  const proposal = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: couple.data.id,
      title: 'Test Proposal',
      proposal_number: 'PR-001',
      status: 'sent',
      subtotal: 5000,
    })
    .select('id, share_token')
    .single();
  if (proposal.error || !proposal.data) {
    throw new Error(`proposal insert failed: ${proposal.error?.message}`);
  }

  // Enable share token
  await admin
    .from('proposals')
    .update({ share_token_enabled: true })
    .eq('id', proposal.data.id);

  return {
    user,
    coupleId: couple.data.id,
    proposalId: proposal.data.id,
    proposalToken: proposal.data.share_token as string,
    portalToken: couple.data.portal_token as string,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('Public branding fields — _user_branding extension', () => {
  describe('get_public_proposal', () => {
    it('returns the new typography and layout fields in the payload', async () => {
      const setup = await arrangeTest();
      cleanupQueue.push(setup.user.cleanup);

      const { data, error } = await anonClient().rpc('get_public_proposal', {
        token: setup.proposalToken,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const payload = data as unknown as Record<string, unknown>;
      // Assert new branding fields are present and match overrides
      expect(payload.heading_size).toBe(44);
      expect(payload.body_size).toBe(18);
      expect(payload.heading_case).toBe('uppercase');
      expect(payload.body_case).toBe('capitalize');
      expect(payload.heading_letter_spacing).toBe(2);
      expect(payload.body_line_height).toBe(1.8);
      expect(payload.link_color).toBe('#FF0000');
      expect(payload.button_variant).toBe('outline');
      expect(payload.button_size).toBe('lg');
      expect(payload.button_radius).toBe(12);
      expect(payload.section_spacing).toBe(48);
      expect(payload.page_background).toBe('#F5F5F5');
    });

    it('returns defaults when branding fields are not set', async () => {
      // Create user WITHOUT custom branding fields
      const user = await createTestUser({}, pro);
      const admin = serviceClient();

      const couple = await user.client
        .from('couples')
        .insert({ user_id: user.id, name: 'Default Couple', status: 'enquiry' })
        .select('id')
        .single();

      const proposal = await user.client
        .from('proposals')
        .insert({
          user_id: user.id,
          couple_id: couple.data!.id,
          title: 'Default Proposal',
          proposal_number: 'PR-002',
          status: 'sent',
          subtotal: 5000,
        })
        .select('id, share_token')
        .single();

      await admin
        .from('proposals')
        .update({ share_token_enabled: true })
        .eq('id', proposal.data!.id);

      cleanupQueue.push(user.cleanup);

      const { data, error } = await anonClient().rpc('get_public_proposal', {
        token: proposal.data!.share_token as string,
      });

      expect(error).toBeNull();

      const payload = data as unknown as Record<string, unknown>;
      // Assert defaults are applied
      expect(payload.heading_size).toBe(32);
      expect(payload.body_size).toBe(15);
      expect(payload.heading_case).toBe('none');
      expect(payload.body_case).toBe('none');
      expect(payload.heading_letter_spacing).toBe(0);
      expect(payload.body_line_height).toBe(1.5);
      expect(payload.button_variant).toBe('fill');
      expect(payload.button_size).toBe('md');
      expect(payload.button_radius).toBe(8);
      expect(payload.section_spacing).toBe(32);
      // link_color and page_background default to brand and surface colors
      expect(payload.link_color).toBeTruthy();
      expect(payload.page_background).toBeTruthy();
    });
  });

  describe('get_portal_data', () => {
    it('returns the new typography and layout fields in the branding payload', async () => {
      const setup = await arrangeTest();
      cleanupQueue.push(setup.user.cleanup);

      const { data, error } = await anonClient().rpc('get_portal_data', {
        token: setup.portalToken,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const payload = data as unknown as Record<string, Record<string, unknown>>;
      expect(payload.branding).not.toBeNull();

      const branding = payload.branding as Record<string, unknown>;
      // Assert new branding fields are present in the branding object
      expect(branding.heading_size).toBe(44);
      expect(branding.body_size).toBe(18);
      expect(branding.heading_case).toBe('uppercase');
      expect(branding.body_case).toBe('capitalize');
      expect(branding.heading_letter_spacing).toBe(2);
      expect(branding.body_line_height).toBe(1.8);
      expect(branding.link_color).toBe('#FF0000');
      expect(branding.button_variant).toBe('outline');
      expect(branding.button_size).toBe('lg');
      expect(branding.button_radius).toBe(12);
      expect(branding.section_spacing).toBe(48);
      expect(branding.page_background).toBe('#F5F5F5');
    });
  });
});
