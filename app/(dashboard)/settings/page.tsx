"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PersonalInfoSection } from "./personal-info-section";
import { BrandingSection } from "./branding-section";
import { AccountSection } from "./account-section";
import { BillingSection } from "./billing-section";
import { TemplatesSection } from "./templates-section";
import { NotificationsSection } from "./notifications-section";
import { StatusesSection } from "./statuses-section";
import { PaymentSettingsSection } from "./payment-settings-section";

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
  business_type?: string;
  subscription_status?: string;
  trial_end?: string;
  subscription_end?: string;
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
}

const tabs = [
  { id: "personal-info", label: "Personal Info" },
  { id: "branding", label: "Branding" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Plans & Billing" },
  { id: "payments", label: "Payments" },
  { id: "templates", label: "Templates" },
  { id: "statuses", label: "Statuses" },
  { id: "notifications", label: "Notifications" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [metadata, setMetadata] = useState<UserMetadata | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = (searchParams.get("tab") as TabId) || "personal-info";

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
      <div>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-24 mb-8" />
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
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="relative overflow-x-auto">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 md:hidden" />
        <div className="flex gap-6 border-b border-gray-200 mb-8">
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
          }}
          email={email || ""}
        />
      )}
      {activeTab === "branding" && (
        <BrandingSection
          initialData={{
            logoUrl: metadata?.logo_url || "",
            brandColor: metadata?.brand_color || "#A7F3D0",
            tagline: metadata?.tagline || "",
            abn: metadata?.abn || "",
            showContactOnDocuments: metadata?.show_contact_on_documents || false,
            businessName: metadata?.business_name || "",
            phone: metadata?.phone || "",
            website: metadata?.website || "",
            instagramUrl: metadata?.instagram_url || "",
            facebookUrl: metadata?.facebook_url || "",
          }}
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
        />
      )}
      {activeTab === "payments" && (
        <PaymentSettingsSection
          initialBankAccountName={metadata?.bank_account_name || ""}
          initialBankBsb={metadata?.bank_bsb || ""}
          initialBankAccountNumber={metadata?.bank_account_number || ""}
          stripeConnectAccountId={metadata?.stripe_connect_account_id || null}
          stripeConnectEnabled={metadata?.stripe_connect_enabled || false}
          justConnected={searchParams.get("connected") === "true"}
        />
      )}
      {activeTab === "templates" && <TemplatesSection />}
      {activeTab === "statuses" && <StatusesSection />}
      {activeTab === "notifications" && <NotificationsSection />}
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
