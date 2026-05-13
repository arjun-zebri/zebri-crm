"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PersonalInfoSection } from "./personal-info-section";
import { AccountSection } from "./account-section";
import { BillingSection } from "./billing-section";
import { TemplatesSection } from "./templates-section";
import { NotificationsSection } from "./notifications-section";
import { StatusesSection } from "./statuses-section";
import { PaymentSettingsSection } from "./payment-settings-section";
import { PortalSection } from "./portal-section";

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
  subscription_status?: string;
  subscription_plan?: string;
  stripe_customer_id?: string;
  trial_end?: string;
  subscription_end?: string;
  cancel_at_period_end?: boolean;
  is_subscribed?: boolean;
  is_comped?: boolean;
  email_preferences?: EmailPreferencesData;
  bank_account_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  stripe_connect_account_id?: string;
  stripe_connect_enabled?: boolean;
  logo_url?: string;
  brand_color?: string;
  tagline?: string;
  abn?: string;
  show_contact_on_documents?: boolean;
  mc_signature_name?: string;
  address_text?: string;
  address_lat?: number;
  address_lng?: number;
  portal_sections?: {
    timeline?: boolean
    contacts?: boolean
    payments?: boolean
    contracts?: boolean
    songs?: boolean
    files?: boolean
  }
}

const tabs = [
  { id: "personal-info", label: "Personal Info" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Plans & Billing" },
  { id: "payments", label: "Receive Payments" },
  { id: "templates", label: "Templates" },
  { id: "statuses", label: "Statuses" },
  { id: "notifications", label: "Notifications" },
  { id: "portal", label: "Portal" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [metadata, setMetadata] = useState<UserMetadata | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = (searchParams.get("tab") as TabId) || "personal-info";

  // Legacy deep-link compatibility: branding has moved to its own top-level route.
  useEffect(() => {
    if (searchParams.get("tab") === "branding") {
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
        setEmail(user.email ?? null);
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
          <div className="h-8 bg-gray-100 rounded w-24 animate-pulse" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 md:px-[3.75rem] animate-pulse">
            <div className="flex gap-6 border-b border-gray-200 mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-100 rounded w-20 mb-3" />
              ))}
            </div>
            <div className="space-y-4 max-w-2xl">
              <div className="h-9 bg-gray-50 rounded w-full" />
              <div className="h-9 bg-gray-50 rounded w-full" />
              <div className="h-9 bg-gray-50 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 md:px-[3.75rem] pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          Settings
        </h1>
      </div>

      <div className="px-6 md:px-[3.75rem] flex-shrink-0">
        <div className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-gray-200">
          <div className="flex gap-6 mb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`pb-3 text-sm whitespace-nowrap transition-colors relative ${
                  activeTab === tab.id
                    ? "text-gray-900 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
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
              status={metadata?.subscription_status || null}
              trialEnd={metadata?.trial_end || null}
              subscriptionEnd={metadata?.subscription_end || null}
              subscriptionPlan={metadata?.subscription_plan || null}
              hasStripeCustomer={!!metadata?.stripe_customer_id}
              cancelAtPeriodEnd={!!metadata?.cancel_at_period_end}
              isSubscribed={!!metadata?.is_subscribed}
              isComped={!!metadata?.is_comped}
            />
          )}
          {activeTab === "payments" && (
            <PaymentSettingsSection
              initialBankAccountName={metadata?.bank_account_name || ""}
              initialBankBsb={metadata?.bank_bsb || ""}
              initialBankAccountNumber={metadata?.bank_account_number || ""}
              stripeConnectAccountId={
                metadata?.stripe_connect_account_id || null
              }
              stripeConnectEnabled={metadata?.stripe_connect_enabled || false}
              justConnected={searchParams.get("connected") === "true"}
            />
          )}
          {activeTab === "templates" && <TemplatesSection />}
          {activeTab === "statuses" && <StatusesSection />}
          {activeTab === "notifications" && <NotificationsSection />}
          {activeTab === "portal" && (
            <PortalSection
              initialSettings={metadata?.portal_sections ? {
                timeline: metadata.portal_sections.timeline ?? true,
                contacts: metadata.portal_sections.contacts ?? true,
                payments: metadata.portal_sections.payments ?? true,
                contracts: metadata.portal_sections.contracts ?? true,
                songs: metadata.portal_sections.songs ?? true,
                files: metadata.portal_sections.files ?? true,
              } : null}
            />
          )}
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
