'use client';

/**
 * The MC's configured IANA timezone, for client components that render
 * local-date wording ("Today", "Overdue").
 *
 * The Workflows page reads the same setting on the server and passes it
 * down; the couple profile is opened from a client list, so it fetches
 * it here instead. Both must agree, or the same step reads "Today" in
 * one place and "Overdue" in the other.
 *
 * Cached under one key with an infinite stale time: the setting changes
 * about once in an account's life.
 *
 * @module app/(dashboard)/couples/use-user-timezone
 */

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

/** App-wide fallback, matching the server-side default. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/** Returns the MC's timezone, defaulting while loading or on error. */
export function useUserTimezone(): string {
  const { data } = useQuery({
    queryKey: ['user-timezone'],
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return DEFAULT_TIMEZONE;
      const { data: settings } = await supabase
        .from('user_public_settings')
        .select('timezone')
        .eq('user_id', user.id)
        .maybeSingle();
      return settings?.timezone ?? DEFAULT_TIMEZONE;
    },
  });

  return data ?? DEFAULT_TIMEZONE;
}
