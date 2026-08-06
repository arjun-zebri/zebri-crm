/**
 * Shadow-mode banner shown to an admin who is viewing the app as
 * another user.
 *
 * Why this is a client component: it used to be an async server
 * component awaiting `cookies()`, and because it renders directly in
 * `app/(dashboard)/layout.tsx` that made the entire dashboard segment
 * dynamic. A dynamic segment with no static shell is not prefetchable,
 * so every `<Link>` in the sidebar fell back to a blocking round trip
 * on click. Reading the flag on the client keeps the whole group
 * statically prerenderable and lets prefetch do its job.
 *
 * `zebri_is_shadowing` is set with `httpOnly: false` (see
 * `enterShadow` in `app/admin/actions.ts`) precisely so the browser can
 * read it. The trust-bearing half of the pair,
 * `zebri_shadow_admin_id`, stays httpOnly and is never read here — this
 * banner is presentation only, and the server actions it links to do
 * their own admin checks.
 *
 * @module app/components/shadow-banner
 */
"use client";

import { useEffect, useState } from "react";

import { exitShadow } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

/** The shadowed user's display identity, or `null` when not shadowing. */
interface ShadowIdentity {
  name: string;
  email: string;
}

/** True when the browser-readable shadow flag is set. */
function isShadowing(): boolean {
  return document.cookie
    .split("; ")
    .some((cookie) => cookie === "zebri_is_shadowing=1");
}

export function ShadowBanner() {
  const [identity, setIdentity] = useState<ShadowIdentity | null>(null);

  useEffect(() => {
    // Cookie read happens in an effect, not during render: the server
    // has no access to document.cookie, so reading it inline would
    // hydrate-mismatch. Admins get a brief frame without the banner,
    // which is the right trade for making every route prefetchable.
    if (!isShadowing()) return;

    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const user = data.user;
        if (cancelled || !user) return;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const displayName =
          typeof meta.display_name === "string" ? meta.display_name : "";
        setIdentity({
          name: displayName || user.email?.split("@")[0] || "User",
          email: user.email ?? "",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!identity) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 h-10 flex items-center justify-between text-body flex-shrink-0">
      <span className="text-amber-800 font-medium">
        Shadow Mode &middot; Viewing as {identity.name}{" "}
        <span className="font-normal text-amber-700">({identity.email})</span>
      </span>
      <form action={exitShadow}>
        <button
          type="submit"
          className="text-caption font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1 rounded-control transition cursor-pointer"
        >
          Exit
        </button>
      </form>
    </div>
  );
}
