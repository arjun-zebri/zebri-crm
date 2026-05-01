"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.account_type !== "admin") {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function listUsers() {
  await assertAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  return (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    display_name: (u.user_metadata?.display_name as string) ?? "",
    business_name: (u.user_metadata?.business_name as string) ?? "",
    account_type: (u.user_metadata?.account_type as string) ?? "vendor",
  }));
}

export async function enterShadow(targetUserId: string) {
  const adminUser = await assertAdmin();

  if (adminUser.id === targetUserId) {
    throw new Error("Cannot shadow yourself");
  }

  const adminSdk = createAdminClient();

  const {
    data: { user: targetUser },
    error: getUserError,
  } = await adminSdk.auth.admin.getUserById(targetUserId);
  if (getUserError || !targetUser?.email) {
    throw getUserError ?? new Error("User not found");
  }

  const { data: linkData, error: linkError } =
    await adminSdk.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
    });
  if (linkError || !linkData.properties.email_otp) {
    throw linkError ?? new Error("Failed to generate session");
  }

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set("zebri_shadow_admin_id", adminUser.id, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  cookieStore.set("zebri_is_shadowing", "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.verifyOtp({
    email: targetUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  redirect("/");
}

export async function clearShadowCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("zebri_shadow_admin_id");
  cookieStore.delete("zebri_is_shadowing");
}

export async function exitShadow() {
  const cookieStore = await cookies();
  const adminId = cookieStore.get("zebri_shadow_admin_id")?.value;

  if (!adminId) {
    redirect("/admin");
  }

  const adminSdk = createAdminClient();

  const {
    data: { user: adminUser },
    error: getUserError,
  } = await adminSdk.auth.admin.getUserById(adminId);
  if (getUserError || !adminUser?.email) {
    throw getUserError ?? new Error("Admin user not found");
  }

  const { data: linkData, error: linkError } =
    await adminSdk.auth.admin.generateLink({
      type: "magiclink",
      email: adminUser.email,
    });
  if (linkError || !linkData.properties.email_otp) {
    throw linkError ?? new Error("Failed to restore admin session");
  }

  cookieStore.delete("zebri_shadow_admin_id");
  cookieStore.delete("zebri_is_shadowing");

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.verifyOtp({
    email: adminUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  redirect("/admin");
}
