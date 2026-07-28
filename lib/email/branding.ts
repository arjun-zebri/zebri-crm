/**
 * Fetch and resolve the sender's branding for templated emails.
 *
 * @module lib/email/branding
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildPublicBranding, type PublicBranding } from '@/lib/branding/public-branding';

/**
 * Fetch the user's branding metadata and resolve it into the template format.
 *
 * Reads from `auth.users.user_metadata` via the provided Supabase client
 * and assembles it into a `PublicBranding` object suitable for email
 * template rendering. Returns null if the user does not exist or has no
 * branding metadata.
 *
 * @param supabase Authenticated Supabase client (typically with service-role
 *   key for fetching another user's metadata).
 * @param userId The user ID to fetch branding for.
 * @returns The resolved `PublicBranding`, or null if not available.
 */
export async function emailBrandingForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PublicBranding | null> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      return null;
    }

    // User metadata is always present on auth.users; empty object if no
    // branding has been set.
    const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;

    // Convert the raw metadata to the resolved PublicBranding shape.
    return buildPublicBranding(metadata);
  } catch {
    // If the admin.getUserById call fails (e.g., wrong client type,
    // permission denied), gracefully return null so emails still send.
    return null;
  }
}
