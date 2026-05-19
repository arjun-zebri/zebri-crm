import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Browser Supabase client, typed against the generated {@link Database} schema.
 *
 * Use in Client Components. Reads the publishable (anon) key — RLS applies.
 * Server code must use the server client (`@/lib/supabase/server`) instead.
 *
 * @returns A `SupabaseClient<Database>` for the current browser session.
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
