"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { exitShadow } from "@/app/admin/actions";

export function ShadowBanner() {
  const [targetUser, setTargetUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const isShadowing = document.cookie
      .split("; ")
      .some((c) => c.startsWith("zebri_is_shadowing=1"));

    if (!isShadowing) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setTargetUser({
          name:
            data.user.user_metadata?.display_name ||
            data.user.email?.split("@")[0] ||
            "User",
          email: data.user.email || "",
        });
      }
    });
  }, []);

  if (!targetUser) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 h-10 flex items-center justify-between text-sm flex-shrink-0">
      <span className="text-amber-800 font-medium">
        Shadow Mode &middot; Viewing as {targetUser.name}{" "}
        <span className="font-normal text-amber-700">({targetUser.email})</span>
      </span>
      <form action={exitShadow}>
        <button
          type="submit"
          className="text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
        >
          Exit
        </button>
      </form>
    </div>
  );
}
