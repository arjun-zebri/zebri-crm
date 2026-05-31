"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  cancelAtPeriodEnd,
  isComped,
  isSubscribed,
  stripeConnectAccountId,
  stripeConnectEnabled,
  stripeCustomerId,
  subscriptionEnd,
  subscriptionPlan,
  subscriptionStatus,
  trialEnd,
} from "@/lib/auth/entitlements";

import { AccountSection } from "./account-section";
import { BillingSection } from "./billing-section";
import { NotificationsSection } from "./notifications-section";
import { PaymentSettingsSection } from "./payment-settings-section";
import { PersonalInfoSection } from "./personal-info-section";
import { StatusesSection } from "./statuses-section";
import { TemplatesSection } from "./templates-section";

interface EmailPreferencesData {
  product_updates?: boolean;
  booking_reminders?: boolean;
  tips?: boolean;
}

interface UserMetadata {
  display_name?: string;
  business_name?: string;
  phone?: string;
  avatar_url?: string;
  website?: string;
  instagram_url?: string;
  facebook_url?: string;
  business_type?: string | string[];
  email_preferences?: EmailPreferencesData;
  bank_account_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  logo_url?: string;
  brand_color?: string;
  tagline?: string;
  abn?: string;
  show_contact_on_documents?: boolean;
  mc_signature_name?: string;
  address_text?: string;
  address_lat?: number;
  address_lng?: number;
}

/**
 * Subset of the auth user shape this page needs to read entitlement
 * fields via the `@/lib/auth/entitlements` helpers. Pre-§7.4 we
 * destructured `app_metadata` inline; that bypassed the canonical
 * accessors and would silently break if the storage shape changed
 * again. The helper takes a `{ app_metadata, user_metadata }` source
 * and is the single read path for these fields.
 */
interface EntitlementSource {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

const tabs = [
  { id: "personal-info", label: "Personal Info" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Plans & Billing" },
  { id: "payments", label: "Receive Payments" },
  { id: "templates", label: "Templates" },
  { id: "statuses", label: "Statuses" },
  { id: "notifications", label: "Notifications" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [metadata, setMetadata] = useState<UserMetadata | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSource | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = (searchParams.get("tab") as TabId) || "personal-info";

  // Legacy deep-link compatibility: branding (and portal sub-tab) live under /branding now.
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "branding" || tab === "portal") {
      router.replace("/branding");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setMetadata(user.user_metadata as UserMetadata);
        setEntitlements({
          app_metadata: user.app_metadata ?? {},
          user_metadata: user.user_metadata ?? {},
        });
        setEmail(user.email ?? null);
        setUserCreatedAt(user.created_at ?? null);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleTabChange = (tabId: TabId) => {
    router.replace(`/settings?tab=${tabId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 md:px-[3.75rem] pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
          <div className="h-8 bg-surface-emphasis rounded w-24 animate-pulse" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 md:px-[3.75rem] animate-pulse">
            <div className="flex gap-6 border-b border-border mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-surface-emphasis rounded w-20 mb-3" />
              ))}
            </div>
            <div className="space-y-4 max-w-2xl">
              <div className="h-9 bg-surface-muted rounded w-full" />
              <div className="h-9 bg-surface-muted rounded w-full" />
              <div className="h-9 bg-surface-muted rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 md:px-[3.75rem] pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text">
          Settings
        </h1>
      </div>

      <div className="px-6 md:px-[3.75rem] flex-shrink-0">
        <div className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-border">
          <div className="flex gap-6 mb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`pb-3 text-sm whitespace-nowrap transition-colors relative ${
                  activeTab === tab.id
                    ? "text-text font-medium"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 md:px-[3.75rem] pt-6 pb-6">
          {activeTab === "personal-info" && (
            <PersonalInfoSection
              initialData={{
                displayName: metadata?.display_name || "",
                businessName: metadata?.business_name || "",
                phone: metadata?.phone || "",
                website: metadata?.website || "",
                instagramUrl: metadata?.instagram_url || "",
                facebookUrl: metadata?.facebook_url || "",
                businessType: metadata?.business_type || "",
                mcSignatureName: metadata?.mc_signature_name || "",
                addressText: metadata?.address_text || "",
                addressLat: metadata?.address_lat ?? null,
                addressLng: metadata?.address_lng ?? null,
              }}
              email={email || ""}
            />
          )}
          {activeTab === "account" && (
            <AccountSection emailPreferences={metadata?.email_preferences} />
          )}
          {activeTab === "billing" && (
            <BillingSection
              status={subscriptionStatus(entitlements) ?? null}
              trialEnd={trialEnd(entitlements) ?? null}
              subscriptionEnd={subscriptionEnd(entitlements) ?? null}
              subscriptionPlan={subscriptionPlan(entitlements) ?? null}
              hasStripeCustomer={!!stripeCustomerId(entitlements)}
              cancelAtPeriodEnd={cancelAtPeriodEnd(entitlements)}
              isSubscribed={isSubscribed(entitlements)}
              isComped={isComped(entitlements)}
              userCreatedAt={userCreatedAt}
            />
          )}
          {activeTab === "payments" && (
            <PaymentSettingsSection
              initialBankAccountName={metadata?.bank_account_name || ""}
              initialBankBsb={metadata?.bank_bsb || ""}
              initialBankAccountNumber={metadata?.bank_account_number || ""}
              stripeConnectAccountId={
                stripeConnectAccountId(entitlements) ?? null
              }
              stripeConnectEnabled={stripeConnectEnabled(entitlements)}
            />
          )}
          {activeTab === "templates" && <TemplatesSection />}
          {activeTab === "statuses" && <StatusesSection />}
          {activeTab === "notifications" && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
