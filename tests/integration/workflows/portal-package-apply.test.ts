import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A couple choosing a package in the portal applies the matching
 * workflow.
 *
 * No new engine code: the portal already writes
 * `couples.selected_package_id`, and the `couples_emit_package_applied`
 * trigger turns that transition into a bus event. What this proves is
 * that the chain survives the portal's SECURITY DEFINER path as well as
 * the MC's own update, because a definer function runs as the owner and
 * an `auth.uid()`-shaped guard in the trigger would silently break it.
 */
describe('portal package selection applies a workflow', () => {
  const admin = serviceClient();
  let user: TestUser;
  let templateId: string;
  let packageId: string;
  let otherPackageId: string;

  /** A couple with its portal token, plus its default instance id. */
  async function seedCouple(name: string): Promise<{ id: string; token: string }> {
    const { data, error } = await admin
      .from('couples')
      .insert({ user_id: user.id, name })
      .select('id, portal_token')
      .single();
    expect(error).toBeNull();
    return { id: data!.id, token: data!.portal_token as string };
  }

  async function instancesFor(coupleId: string) {
    const { data } = await admin
      .from('workflow_instances')
      .select('id, template_id')
      .eq('couple_id', coupleId)
      .eq('template_id', templateId);
    return data ?? [];
  }

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );

    const { data: packages, error: pkgErr } = await admin
      .from('packages')
      .insert([
        { user_id: user.id, name: 'Gold', fixed_price: 3000, pricing_mode: 'single' },
        { user_id: user.id, name: 'Silver', fixed_price: 2000, pricing_mode: 'single' },
      ])
      .select('id, name');
    expect(pkgErr).toBeNull();
    packageId = packages!.find((p) => p.name === 'Gold')!.id;
    otherPackageId = packages!.find((p) => p.name === 'Silver')!.id;

    const { data: template, error: tplErr } = await admin
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Gold onboarding',
        status: 'active',
        apply_rule_type: 'on_package_applied',
        apply_rule_config: { packageId },
      })
      .select('id')
      .single();
    expect(tplErr).toBeNull();
    templateId = template!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('applies the workflow when the couple picks the package in the portal', async () => {
    const couple = await seedCouple('Portal Picks Gold');

    const { error } = await admin.rpc('save_portal_package', {
      p_token: couple.token,
      p_package_id: packageId,
    });
    expect(error).toBeNull();

    await dispatchPendingEvents(admin);
    expect(await instancesFor(couple.id)).toHaveLength(1);
  });

  it('applies the same workflow when the MC sets the package directly', async () => {
    const couple = await seedCouple('MC Picks Gold');

    const { error } = await admin
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', couple.id);
    expect(error).toBeNull();

    await dispatchPendingEvents(admin);
    expect(await instancesFor(couple.id)).toHaveLength(1);
  });

  it('does not apply for a package the rule does not name', async () => {
    const couple = await seedCouple('Portal Picks Silver');

    await admin.rpc('save_portal_package', {
      p_token: couple.token,
      p_package_id: otherPackageId,
    });

    await dispatchPendingEvents(admin);
    expect(await instancesFor(couple.id)).toHaveLength(0);
  });

  it('does not re-apply when the couple re-picks the same package', async () => {
    const couple = await seedCouple('Portal Repicks Gold');

    await admin.rpc('save_portal_package', {
      p_token: couple.token,
      p_package_id: packageId,
    });
    await dispatchPendingEvents(admin);

    // The trigger is guarded on the value actually changing, so a
    // no-op write emits nothing and the couple does not get a second
    // set of onboarding emails.
    await admin.rpc('save_portal_package', {
      p_token: couple.token,
      p_package_id: packageId,
    });
    await dispatchPendingEvents(admin);

    expect(await instancesFor(couple.id)).toHaveLength(1);
  });

  it('does not apply when the package is cleared', async () => {
    const couple = await seedCouple('Portal Clears');

    // Clearing is `null` through the same RPC; the trigger only fires
    // on a transition TO a package, so nothing applies.
    await admin.rpc('save_portal_package', {
      p_token: couple.token,
      p_package_id: null as unknown as string,
    });

    await dispatchPendingEvents(admin);
    expect(await instancesFor(couple.id)).toHaveLength(0);
  });
});
