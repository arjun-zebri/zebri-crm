import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * RLS coverage for the `proposal-media` storage bucket (public, owner-only
 * write) added by `supabase/migrations/20260924000000_proposal_surface.sql`:
 * upload/delete are gated on the first path segment matching `auth.uid()`,
 * while every object is publicly readable (the public proposal page has no
 * session).
 */
describe('RLS: proposal-media storage bucket', () => {
  let userA: TestUser;
  let userB: TestUser;
  const bucket = 'proposal-media';
  const video = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'video/mp4' });

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    // Best-effort cleanup: remove any object either user's path may still
    // hold, then delete the auth users.
    const admin = serviceClient();
    await admin.storage.from(bucket).remove([`${userA.id}/x.mp4`, `${userB.id}/x.mp4`]);
    await userA.cleanup();
    await userB.cleanup();
  });

  it('user A can upload to their own path', async () => {
    const { error } = await userA.client.storage
      .from(bucket)
      .upload(`${userA.id}/x.mp4`, video, { contentType: 'video/mp4' });
    expect(error).toBeNull();
  });

  it('user A cannot upload under user B\'s path', async () => {
    const { error } = await userA.client.storage
      .from(bucket)
      .upload(`${userB.id}/x.mp4`, video, { contentType: 'video/mp4' });
    expect(error).not.toBeNull();
  });

  it('an anonymous visitor can read user A\'s object (public bucket)', async () => {
    const { data, error } = await anonClient().storage.from(bucket).download(`${userA.id}/x.mp4`);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('user B cannot delete user A\'s object', async () => {
    const { error } = await userB.client.storage.from(bucket).remove([`${userA.id}/x.mp4`]);
    // supabase-js resolves a denied remove with an empty `data` array and no
    // top-level error; assert the object is still there instead.
    expect(error).toBeNull();
    const { data: stillThere } = await anonClient().storage.from(bucket).download(`${userA.id}/x.mp4`);
    expect(stillThere).not.toBeNull();
  });

  it('user A can delete their own object', async () => {
    const { error } = await userA.client.storage.from(bucket).remove([`${userA.id}/x.mp4`]);
    expect(error).toBeNull();
    const { error: downloadError } = await anonClient().storage.from(bucket).download(`${userA.id}/x.mp4`);
    expect(downloadError).not.toBeNull();
  });
});
