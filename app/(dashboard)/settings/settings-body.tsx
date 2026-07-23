/**
 * Renders the active section inside the Settings modal. Pure switch on
 * `activeTab`, owns no data fetching; the modal loads the user once
 * and passes it down. Existing section components are reused unchanged.
 *
 * @module app/(dashboard)/settings/settings-body
 */
'use client';

import type { JSONContent } from '@tiptap/react';

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
} from '@/lib/auth/entitlements';

import { AccountSection } from './account-section';
import { BillingSection } from './billing-section';
import { EmailSignatureSection } from './email-signature-section';
import { PaymentSettingsSection } from './payment-settings-section';
import { PersonalInfoSection } from './personal-info-section';
import { PrivacySection } from './privacy-section';
import { PublicPageSection } from './public-page-section';
import type { SettingsTabId } from './settings-nav';
import { TermsSection } from './terms-section';

interface EmailPreferencesData {
  product_updates?: boolean;
  booking_reminders?: boolean;
  tips?: boolean;
}

export interface UserMetadata {
  display_name?: string;
  business_name?: string;
  phone?: string;
  avatar_url?: string;
  website?: string;
  instagram_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  pinterest_url?: string;
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
  /** Reusable email signature (TipTap JSON), used via `{{mc.signature}}`. */
  email_signature?: JSONContent;
  address_text?: string;
  address_lat?: number;
  address_lng?: number;
}

export interface EntitlementSource {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Persisted Public Page settings (subdomain + connected OAuth mailbox),
 * loaded from `user_public_settings` and threaded into the section so it
 * renders the saved state rather than local defaults. The OAuth tokens are
 * never loaded here — only the connection's presence/provider/address.
 */
export interface PublicSettingsData {
  subdomain: string | null;
  emailMode: 'zebri' | 'oauth';
  oauthProvider: 'google' | 'microsoft' | null;
  oauthEmail: string | null;
  oauthStatus: 'none' | 'connected' | 'failed';
}

export interface SettingsData {
  metadata: UserMetadata | null;
  entitlements: EntitlementSource | null;
  email: string | null;
  userCreatedAt: string | null;
  publicSettings: PublicSettingsData | null;
}

export interface SettingsBodyProps {
  activeTab: SettingsTabId;
  data: SettingsData;
}

export function SettingsBody({ activeTab, data }: SettingsBodyProps) {
  const { metadata, entitlements, email, userCreatedAt } = data;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-5 sm:px-8 py-6">
        {activeTab === 'personal-info' && (
          <PersonalInfoSection
            initialData={{
              displayName: metadata?.display_name || '',
              businessName: metadata?.business_name || '',
              phone: metadata?.phone || '',
              website: metadata?.website || '',
              instagramUrl: metadata?.instagram_url || '',
              facebookUrl: metadata?.facebook_url || '',
              twitterUrl: metadata?.twitter_url || '',
              pinterestUrl: metadata?.pinterest_url || '',
              businessType: metadata?.business_type || '',
              mcSignatureName: metadata?.mc_signature_name || '',
              addressText: metadata?.address_text || '',
              addressLat: metadata?.address_lat ?? null,
              addressLng: metadata?.address_lng ?? null,
            }}
            email={email || ''}
          />
        )}
        {activeTab === 'account' && (
          <AccountSection emailPreferences={metadata?.email_preferences} />
        )}
        {activeTab === 'billing' && (
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
        {activeTab === 'payments' && (
          <PaymentSettingsSection
            initialBankAccountName={metadata?.bank_account_name || ''}
            initialBankBsb={metadata?.bank_bsb || ''}
            initialBankAccountNumber={metadata?.bank_account_number || ''}
            stripeConnectAccountId={stripeConnectAccountId(entitlements) ?? null}
            stripeConnectEnabled={stripeConnectEnabled(entitlements)}
          />
        )}
        {activeTab === 'public' && (
          <PublicPageSection
            seedName={metadata?.business_name || metadata?.display_name || ''}
            initial={data.publicSettings}
          />
        )}
        {activeTab === 'signature' && (
          <EmailSignatureSection initialContent={metadata?.email_signature ?? null} />
        )}
        {activeTab === 'privacy' && <PrivacySection />}
        {activeTab === 'terms' && <TermsSection />}
      </div>
    </div>
  );
}
