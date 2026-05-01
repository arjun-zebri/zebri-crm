import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exitShadow } from "@/app/admin/actions";

export async function ShadowBanner() {
  const cookieStore = await cookies();
  const isShadowing = cookieStore.get("zebri_is_shadowing")?.value === "1";

  if (!isShadowing) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const name =
    (user.user_metadata?.display_name as string) ||
    user.email?.split("@")[0] ||
    "User";
  const email = user.email || "";

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 h-10 flex items-center justify-between text-sm flex-shrink-0">
      <span className="text-amber-800 font-medium">
        Shadow Mode &middot; Viewing as {name}{" "}
        <span className="font-normal text-amber-700">({email})</span>
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
