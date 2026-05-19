import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server Supabase client, typed against the generated {@link Database} schema.
 *
 * Use in Server Components, Server Actions, and Route Handlers. Bound to the
 * request's auth cookies so RLS runs as the signed-in user. Cookie writes are
 * best-effort (a no-op in contexts where the response is already sent).
 *
 * @returns A `SupabaseClient<Database>` scoped to the current request.
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookies can't be set in middleware, but we still need to try
          }
        },
      },
    }
  );
};
