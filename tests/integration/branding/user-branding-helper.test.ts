/**
 * Phase 11 — `_user_branding(uuid)` helper RPC tests.
 *
 * `_user_branding` is the SECURITY DEFINER helper that pulls the
 * scalar branding fields (colours, fonts, business name, etc.)
 * out of `auth.users.raw_user_meta_data` and returns them as a
 * jsonb object. It's the engine the public RPCs use to merge
 * branding into the quote / invoice / timeline / portal payloads.
 *
 * It is **`REVOKE ALL FROM anon, authenticated, public`** — it's
 * an internal helper, only callable from other SECURITY DEFINER
 * RPCs (which run as `postgres`). We exercise it here through the
 * service-role client, which can call any function regardless of
 * grants, so we're testing the helper's contract independently
 * of its callers.
 *
 * What we prove:
 *
 * - Returns the requested user's scalars verbatim, not a different
 *   user's (the foundation of the whole public-surface model:
 *   token-resolved user_id flows into `_user_branding(p_user_id)`
 *   and gets back THAT user's branding, not anyone else's).
 * - Returns a sensible default object (with the documented
 *   fallback values) for a user with no metadata set.
 * - Returns NULL only when the requested user does not exist.
 */
import { afterAll, describe, expect, it } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = { subscription_status: 'active', subscription_plan: 'pro' };

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(
    cleanupQueue.map((fn) => fn().catch(() => undefined)),
  );
});

describe('_user_branding(uuid) — internal helper', () => {
  it('returns the requested user\'s scalars, not a different user\'s', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    cleanupQueue.push(userA.cleanup, userB.cleanup);

    const admin = serviceClient();
    await admin.auth.admin.updateUserById(userA.id, {
      user_metadata: {
        business_name: 'A Studios',
        brand_color: '#112233',
        font_heading: 'playfair',
      },
    });
    await admin.auth.admin.updateUserById(userB.id, {
      user_metadata: {
        business_name: 'B Studios',
        brand_color: '#aabbcc',
        font_heading: 'inter',
      },
    });

    const a = await admin.rpc('_user_branding', { p_user_id: userA.id });
    const b = await admin.rpc('_user_branding', { p_user_id: userB.id });

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const aPayload = a.data as unknown as {
      business_name: string;
      brand_color: string;
      font_heading: string;
    };
    const bPayload = b.data as unknown as {
      business_name: string;
      brand_color: string;
      font_heading: string;
    };

    expect(aPayload.business_name).toBe('A Studios');
    expect(aPayload.brand_color).toBe('#112233');
    expect(aPayload.font_heading).toBe('playfair');

    expect(bPayload.business_name).toBe('B Studios');
    expect(bPayload.brand_color).toBe('#aabbcc');
    expect(bPayload.font_heading).toBe('inter');
  });

  it('returns documented defaults for a user with no metadata set', async () => {
    // Users created via createTestUser already get some metadata
    // applied. Clear it explicitly so we can prove the COALESCE
    // fallbacks in the helper return the expected defaults.
    const user = await createTestUser({}, pro);
    cleanupQueue.push(user.cleanup);
    const admin = serviceClient();
    await admin.auth.admin.updateUserById(user.id, { user_metadata: {} });

    const { data, error } = await admin.rpc('_user_branding', {
      p_user_id: user.id,
    });
    expect(error).toBeNull();
    const payload = data as unknown as {
      brand_color: string;
      accent_color: string;
      surface_color: string;
      text_color: string;
      font_heading: string;
      font_body: string;
      density: string;
      corner_radius: number;
      theme_preset: string;
      show_contact_on_documents: boolean;
    };

    // These constants are baked into the helper's COALESCE
    // expressions (see migration 20260516000000). If anyone changes
    // them, this test should fail loudly so we audit the impact on
    // existing public surfaces.
    expect(payload.brand_color).toBe('#A7F3D0');
    expect(payload.accent_color).toBe('#111827');
    expect(payload.surface_color).toBe('#ffffff');
    expect(payload.text_color).toBe('#111827');
    expect(payload.font_heading).toBe('inter');
    expect(payload.font_body).toBe('inter');
    expect(payload.density).toBe('cozy');
    expect(payload.corner_radius).toBe(12);
    expect(payload.theme_preset).toBe('minimal');
    expect(payload.show_contact_on_documents).toBe(true);
  });

  it('returns NULL when the requested user does not exist', async () => {
    const admin = serviceClient();
    const { data, error } = await admin.rpc('_user_branding', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('does not leak between users even when both have metadata set', async () => {
    // Anti-confused-deputy at the helper layer: passing user A's id
    // never returns user B's data, regardless of which user the
    // helper is called from.
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    cleanupQueue.push(userA.cleanup, userB.cleanup);

    const admin = serviceClient();
    await admin.auth.admin.updateUserById(userA.id, {
      user_metadata: { business_name: 'A Studios' },
    });
    await admin.auth.admin.updateUserById(userB.id, {
      user_metadata: { business_name: 'B Studios' },
    });

    const { data } = await admin.rpc('_user_branding', {
      p_user_id: userA.id,
    });
    const payload = data as unknown as { business_name: string };
    expect(payload.business_name).toBe('A Studios');
    expect(payload.business_name).not.toBe('B Studios');
  });
});
