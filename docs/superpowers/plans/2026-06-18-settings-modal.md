# Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Settings full-page route into an overlay modal with a left side-tab nav (matching the Couple Profile overlay), adding inline Privacy and Terms sections.

**Architecture:** Next.js App Router parallel + intercepting routes. A `@modal` slot in the dashboard layout renders `<SettingsModal/>` for soft navigation to `/settings` (overlay over the current page). The real `/settings/page.tsx` becomes a hard-load fallback that renders the dashboard home as a backdrop plus the same modal. The modal reuses the couple-profile overlay shell + a couple-profile-nav-style side nav, and reuses the existing settings section components unchanged.

**Tech Stack:** Next.js 16 (App Router, parallel/intercepting routes), React 19, Tailwind 4, Radix, lucide-react, Supabase auth, `@/lib/auth/entitlements`.

## Global Constraints

- Lucide icons: `strokeWidth={1.5}` always.
- Components ≤ ~150 lines per file; pages/orchestrators only compose.
- Buttons `rounded-xl`, never `rounded-full`; interactive elements `cursor-pointer`.
- Reuse existing section components unchanged (legacy `gray-*` styling kept as-is — NOT retrofitted to tokens in this plan).
- `npm run typecheck` must stay at 0 errors; `npm run lint:gate` must not regress.
- Legacy redirects must be preserved: `?tab=branding|portal` → `/branding`; `?tab=templates` → `/templates`.
- Modal shell mirrors `couple-profile.tsx`: `bg-black/40 backdrop-blur-sm` backdrop, `bg-white rounded-2xl shadow-xl`, `sm:w-[90vw] sm:max-w-[1100px] h-full sm:h-[90vh]`, `animate-modal-in`.

---

### Task 1: Side-tab nav component

**Files:**
- Create: `app/(dashboard)/settings/settings-nav.tsx`

**Interfaces:**
- Produces:
  - `type SettingsTabId = 'personal-info' | 'account' | 'billing' | 'payments' | 'privacy' | 'terms'`
  - `interface SettingsNavItem { key: SettingsTabId; label: string; icon: React.ReactNode }`
  - `const SETTINGS_NAV_ITEMS: SettingsNavItem[]`
  - `function SettingsNav({ navItems, activeTab, onTabChange }: { navItems: SettingsNavItem[]; activeTab: SettingsTabId; onTabChange: (id: SettingsTabId) => void })`

- [ ] **Step 1: Create the nav component**

```tsx
/**
 * Tab navigation for the Settings overlay modal.
 *
 * Mirrors `couple-profile-nav`: a vertical sidebar on desktop and a
 * horizontal scrollable pill row on mobile, driven by one nav-item
 * array. Stateless — the parent owns `activeTab`.
 *
 * @module app/(dashboard)/settings/settings-nav
 */
'use client';

import {
  Bell,
  CreditCard,
  FileText,
  Landmark,
  Shield,
  User,
} from 'lucide-react';

export type SettingsTabId =
  | 'personal-info'
  | 'account'
  | 'billing'
  | 'payments'
  | 'privacy'
  | 'terms';

export interface SettingsNavItem {
  key: SettingsTabId;
  label: string;
  icon: React.ReactNode;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { key: 'personal-info', label: 'Personal Info', icon: <User size={18} strokeWidth={1.5} /> },
  { key: 'account', label: 'Account', icon: <Bell size={18} strokeWidth={1.5} /> },
  { key: 'billing', label: 'Plans & Billing', icon: <CreditCard size={18} strokeWidth={1.5} /> },
  { key: 'payments', label: 'Receive Payments', icon: <Landmark size={18} strokeWidth={1.5} /> },
  { key: 'privacy', label: 'Privacy', icon: <Shield size={18} strokeWidth={1.5} /> },
  { key: 'terms', label: 'Terms', icon: <FileText size={18} strokeWidth={1.5} /> },
];

export interface SettingsNavProps {
  navItems: SettingsNavItem[];
  activeTab: SettingsTabId;
  onTabChange: (id: SettingsTabId) => void;
}

export function SettingsNav({ navItems, activeTab, onTabChange }: SettingsNavProps) {
  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="sm:hidden shrink-0 border-b border-gray-200 overflow-x-auto">
        <div className="flex px-2 py-2 gap-1 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                activeTab === item.key
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:block w-[200px] shrink-0 border-r border-gray-200 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
              activeTab === item.key
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/settings/settings-nav.tsx"
git commit -m "feat(settings): side-tab nav for settings modal"
```

---

### Task 2: Privacy & Terms legal sections

**Files:**
- Create: `app/(dashboard)/settings/legal-section.tsx`
- Create: `app/(dashboard)/settings/privacy-section.tsx`
- Create: `app/(dashboard)/settings/terms-section.tsx`

**Interfaces:**
- Produces:
  - `function LegalSection({ title, lastUpdated, canonicalUrl, children }: { title: string; lastUpdated: string; canonicalUrl: string; children: React.ReactNode })`
  - `function PrivacySection()`
  - `function TermsSection()`

- [ ] **Step 1: Create the shared legal layout**

```tsx
/**
 * Shared chrome for the inline legal sections (Privacy, Terms) in the
 * Settings modal. Renders a title, a "last updated" line, a canonical
 * link to the published version on zebri.com.au, and the prose body.
 *
 * NOTE: the body copy mirrors the published policy at the canonical
 * URL. Confirm verbatim before relying on it as the legal source of
 * truth — the published page remains canonical.
 *
 * @module app/(dashboard)/settings/legal-section
 */
'use client';

import { ExternalLink } from 'lucide-react';

export interface LegalSectionProps {
  title: string;
  lastUpdated: string;
  canonicalUrl: string;
  children: React.ReactNode;
}

export function LegalSection({ title, lastUpdated, canonicalUrl, children }: LegalSectionProps) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-400">Last updated: {lastUpdated}</p>
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer"
      >
        View the latest at {canonicalUrl.replace(/^https?:\/\//, '')}
        <ExternalLink size={14} strokeWidth={1.5} />
      </a>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-gray-700 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-5 [&_h3]:mb-1.5 [&_p]:text-gray-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-gray-900 [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Privacy section**

```tsx
/**
 * Inline Zebri Privacy Policy rendered inside the Settings modal.
 * Copy mirrors zebri.com.au/privacy (canonical).
 *
 * @module app/(dashboard)/settings/privacy-section
 */
'use client';

import { LegalSection } from './legal-section';

export function PrivacySection() {
  return (
    <LegalSection title="Privacy Policy" lastUpdated="10 March 2026" canonicalUrl="https://www.zebri.com.au/privacy">
      <p>
        Zebri is operated by Knotify Pty Ltd (ABN 64 674 946 804), based in Sydney,
        NSW, Australia. This policy explains how we collect, use, and protect your
        information. We are bound by the Privacy Act 1988 (Cth) and the Australian
        Privacy Principles (APPs).
      </p>

      <h3>1. Information we collect</h3>
      <ul>
        <li><strong>Account information:</strong> name and email at registration; billing data via Stripe for paid plans. We do not store full payment card details.</li>
        <li><strong>Content you create:</strong> couple records, contact details, run sheets, timelines, vendor information, notes, scripts, invoices, and files — all of which belong to you.</li>
        <li><strong>Usage data:</strong> pages visited, features used, session duration, browser type, operating system, and IP address (via PostHog).</li>
        <li><strong>Communications:</strong> support enquiries and contact details, retained for response and record-keeping.</li>
        <li><strong>Cookies:</strong> session management and analytics only. We do not use advertising or tracking cookies.</li>
      </ul>

      <h3>2. How we use your information</h3>
      <p>
        To provide the service, process transactions, respond to support, analyse and
        improve the product, and comply with legal obligations. We do not sell, rent,
        or trade your personal information to third parties.
      </p>

      <h3>3. Third-party processors</h3>
      <ul>
        <li>Vercel — infrastructure (SOC 2 Type 2)</li>
        <li>Supabase — database and authentication</li>
        <li>Stripe — payment processing (PCI DSS Level 1)</li>
        <li>Resend — transactional email</li>
        <li>PostHog — anonymised usage analytics</li>
      </ul>

      <h3>4. Data retention</h3>
      <p>
        Your data is retained while your subscription is active. After cancellation or
        account closure it is retained for 30 days and then deleted; backups purge
        within 90 days.
      </p>

      <h3>5. Data security</h3>
      <p>
        We use TLS encryption in transit, encrypted storage at rest, and access
        controls. No method of transmission is 100% secure.
      </p>

      <h3>6. International transfers</h3>
      <p>
        Infrastructure providers may use non-Australian data centres (particularly in
        the US), with appropriate safeguards via certified providers.
      </p>

      <h3>7. Your rights</h3>
      <p>
        Under the Australian Privacy Principles you may access, correct, delete, and
        opt out, and lodge a complaint with the OAIC (oaic.gov.au). Contact
        hello@zebri.com.au — we respond within 30 days.
      </p>

      <h3>8. Children</h3>
      <p>The platform is not directed at, and is not intended for, persons under 16.</p>

      <h3>9. Changes & governing law</h3>
      <p>
        Material updates trigger email notice at least 14 days before they take effect.
        This policy is governed by the law of New South Wales.
      </p>

      <h3>10. Contact us</h3>
      <p>Knotify Pty Ltd · ABN 64 674 946 804 · Sydney, NSW · hello@zebri.com.au</p>
    </LegalSection>
  );
}
```

- [ ] **Step 3: Create the Terms section**

```tsx
/**
 * Inline Zebri Terms of Service rendered inside the Settings modal.
 * Copy mirrors zebri.com.au/terms (canonical).
 *
 * @module app/(dashboard)/settings/terms-section
 */
'use client';

import { LegalSection } from './legal-section';

export function TermsSection() {
  return (
    <LegalSection title="Terms of Service" lastUpdated="10 March 2026" canonicalUrl="https://www.zebri.com.au/terms">
      <p>
        These Terms of Service are a legally binding agreement between you and Knotify
        Pty Ltd trading as Zebri. By using the platform you agree to them.
      </p>

      <h3>1. Accounts</h3>
      <p>
        You must be 18 or older, provide accurate information, and keep your password
        secure. Holding more than one account requires our written consent.
      </p>

      <h3>2. Subscriptions & billing</h3>
      <p>
        Free, Pro, and Max plans are available with a 14-day free trial. Pricing is in
        AUD and includes GST. Monthly subscriptions are non-refundable; annual
        subscriptions are fully refundable within 14 days if minimally used.
      </p>

      <h3>3. Cancellation</h3>
      <p>
        You may cancel at any time; access continues through the current billing
        period. Your content remains accessible for 30 days after cancellation so you
        can export it.
      </p>

      <h3>4. Acceptable use</h3>
      <p>You may not reverse engineer the platform, scrape data, exceed the scope of the Free plan, upload illegal content, or store sensitive financial or health records beyond what wedding management requires.</p>

      <h3>5. Content ownership</h3>
      <p>You retain full ownership of all content you create or upload.</p>

      <h3>6. Liability</h3>
      <p>
        Our maximum liability is limited to the fees you paid in the preceding 12
        months or AUD $100, whichever is greater. We are not liable for indirect or
        consequential damages.
      </p>

      <h3>7. Governing law</h3>
      <p>
        These Terms are governed by the law of New South Wales, Australia, with
        mandatory informal dispute resolution before any litigation.
      </p>

      <h3>8. Contact us</h3>
      <p>Knotify Pty Ltd · ABN 64 674 946 804 · Sydney, NSW · hello@zebri.com.au</p>
    </LegalSection>
  );
}
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/settings/legal-section.tsx" "app/(dashboard)/settings/privacy-section.tsx" "app/(dashboard)/settings/terms-section.tsx"
git commit -m "feat(settings): inline Privacy and Terms sections"
```

---

### Task 3: Settings body (section switch)

**Files:**
- Create: `app/(dashboard)/settings/settings-body.tsx`

**Interfaces:**
- Consumes (from Task 1): `SettingsTabId`. (from Task 2): `PrivacySection`, `TermsSection`. Existing: `PersonalInfoSection`, `AccountSection`, `BillingSection`, `PaymentSettingsSection`, entitlement helpers.
- Produces:
  - `interface SettingsData { metadata: UserMetadata | null; entitlements: EntitlementSource | null; email: string | null; userCreatedAt: string | null }`
  - `function SettingsBody({ activeTab, data }: { activeTab: SettingsTabId; data: SettingsData })`
  - Re-exports `UserMetadata`, `EntitlementSource` types for the modal to use.

- [ ] **Step 1: Create the body switch**

```tsx
/**
 * Renders the active section inside the Settings modal. Pure switch on
 * `activeTab` — owns no data fetching; the modal loads the user once
 * and passes it down. Existing section components are reused unchanged.
 *
 * @module app/(dashboard)/settings/settings-body
 */
'use client';

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
import { PaymentSettingsSection } from './payment-settings-section';
import { PersonalInfoSection } from './personal-info-section';
import { PrivacySection } from './privacy-section';
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

export interface EntitlementSource {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface SettingsData {
  metadata: UserMetadata | null;
  entitlements: EntitlementSource | null;
  email: string | null;
  userCreatedAt: string | null;
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
        {activeTab === 'privacy' && <PrivacySection />}
        {activeTab === 'terms' && <TermsSection />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: 0 errors. (If `subscriptionStatus(entitlements)` etc. complain about the `EntitlementSource` shape, confirm the helper accepts `{ app_metadata, user_metadata }` — it does in the current `page.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/settings/settings-body.tsx"
git commit -m "feat(settings): settings body section switch"
```

---

### Task 4: Settings modal orchestrator

**Files:**
- Create: `app/(dashboard)/settings/settings-modal.tsx`

**Interfaces:**
- Consumes (Task 1): `SettingsNav`, `SETTINGS_NAV_ITEMS`, `SettingsTabId`. (Task 3): `SettingsBody`, `SettingsData`, `UserMetadata`, `EntitlementSource`.
- Produces:
  - `function SettingsModal()` — self-contained: loads the user, reads `?tab=`, handles legacy redirects, renders the overlay shell + nav + body, closes via `router.back()`.

- [ ] **Step 1: Create the modal orchestrator**

```tsx
/**
 * Settings overlay modal. Mirrors the couple-profile overlay shell
 * (centered rounded card, side-nav + scrollable body). Rendered by
 * the `@modal` intercepting route on soft nav to `/settings`, and by
 * the `/settings` page itself on hard load (over the dashboard).
 *
 * Self-contained: loads the auth user once, reads the active tab from
 * `?tab=`, and routes tab changes through `router.replace` so they are
 * deep-linkable. Closes with `router.back()` (falls back to `/`).
 *
 * @module app/(dashboard)/settings/settings-modal
 */
'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { SettingsBody, type EntitlementSource, type SettingsData, type UserMetadata } from './settings-body';
import { SETTINGS_NAV_ITEMS, SettingsNav, type SettingsTabId } from './settings-nav';

const VALID_TABS = SETTINGS_NAV_ITEMS.map((i) => i.key) as SettingsTabId[];

export function SettingsModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsData | null>(null);

  const rawTab = searchParams.get('tab');
  const activeTab: SettingsTabId =
    rawTab && VALID_TABS.includes(rawTab as SettingsTabId)
      ? (rawTab as SettingsTabId)
      : 'personal-info';

  // Legacy deep-link compatibility: branding/portal live under
  // /branding now; templates moved to /templates.
  useEffect(() => {
    if (rawTab === 'branding' || rawTab === 'portal') {
      router.replace('/branding');
    } else if (rawTab === 'templates') {
      router.replace('/templates');
    }
  }, [rawTab, router]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setData({
        metadata: (user?.user_metadata as UserMetadata) ?? null,
        entitlements: user
          ? ({ app_metadata: user.app_metadata ?? {}, user_metadata: user.user_metadata ?? {} } as EntitlementSource)
          : null,
        email: user?.email ?? null,
        userCreatedAt: user?.created_at ?? null,
      });
    };
    load();
  }, []);

  // Close = pop history back to wherever the modal opened from; fall
  // back to the dashboard home if there's nothing to pop (hard load).
  const handleClose = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (id: SettingsTabId) => {
    router.replace(`/settings?tab=${id}`);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" onClick={handleClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4" onClick={handleClose}>
        <div
          data-testid="settings-panel"
          className="bg-white rounded-2xl shadow-xl w-full sm:w-[90vw] sm:max-w-[1100px] h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 shrink-0">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
              aria-label="Close settings"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Body: nav + content */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            <SettingsNav navItems={SETTINGS_NAV_ITEMS} activeTab={activeTab} onTabChange={handleTabChange} />
            {data ? (
              <SettingsBody activeTab={activeTab} data={data} />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-5 sm:px-8 py-6 space-y-4 max-w-2xl animate-pulse">
                  <div className="h-9 bg-gray-100 rounded w-full" />
                  <div className="h-9 bg-gray-100 rounded w-full" />
                  <div className="h-9 bg-gray-100 rounded w-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/settings/settings-modal.tsx"
git commit -m "feat(settings): settings modal orchestrator shell"
```

---

### Task 5: Wire up routes (intercept + parallel slot + fallback)

**Files:**
- Create: `app/(dashboard)/@modal/default.tsx`
- Create: `app/(dashboard)/@modal/(.)settings/page.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify (replace): `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes (Task 4): `SettingsModal`. Existing: `DashboardPage` (default export of `app/(dashboard)/page.tsx`).

- [ ] **Step 1: Add the `@modal` default slot (renders nothing)**

Create `app/(dashboard)/@modal/default.tsx`:

```tsx
/**
 * Default render for the `@modal` parallel slot — nothing. The slot
 * only renders content when an intercepting route (e.g. `(.)settings`)
 * matches the current URL.
 *
 * @module app/(dashboard)/@modal/default
 */
export default function ModalDefault() {
  return null;
}
```

- [ ] **Step 2: Add the intercepting route for soft nav**

Create `app/(dashboard)/@modal/(.)settings/page.tsx`:

```tsx
/**
 * Intercepting route: when the user soft-navigates to `/settings`
 * from within the dashboard (e.g. the sidebar link), render the
 * Settings modal as an overlay over the current page instead of a
 * full-page navigation.
 *
 * @module app/(dashboard)/@modal/(.)settings/page
 */
import { Suspense } from 'react';

import { SettingsModal } from '../../settings/settings-modal';

export default function InterceptedSettingsPage() {
  return (
    <Suspense>
      <SettingsModal />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add the `@modal` slot to the layout**

Modify `app/(dashboard)/layout.tsx` to accept and render the `modal` slot:

```tsx
import { SidebarLayout } from "@/app/components/sidebar-layout";
import { ShadowBanner } from "@/app/components/shadow-banner";

export default function DashboardLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <SidebarLayout>
      <ShadowBanner />
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
      {modal}
    </SidebarLayout>
  );
}
```

- [ ] **Step 4: Replace the `/settings` page with the hard-load fallback**

Replace the entire contents of `app/(dashboard)/settings/page.tsx`:

```tsx
/**
 * Hard-load / refresh fallback for `/settings`. Soft navigation is
 * handled by the `@modal/(.)settings` intercepting route, which keeps
 * the originating page behind the modal. On a direct hit or refresh
 * there is no originating page, so we render the dashboard home as the
 * backdrop and the Settings modal on top of it.
 *
 * @module app/(dashboard)/settings/page
 */
'use client';

import { Suspense } from 'react';

import DashboardPage from '../page';

import { SettingsModal } from './settings-modal';

export default function SettingsRouteFallback() {
  return (
    <Suspense>
      <DashboardPage />
      <SettingsModal />
    </Suspense>
  );
}
```

- [ ] **Step 5: Verify the build typechecks and the gates hold**

Run: `npm run typecheck && npm run lint:gate`
Expected: typecheck 0 errors; lint:gate passes (no budget regression).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/@modal/default.tsx" "app/(dashboard)/@modal/(.)settings/page.tsx" "app/(dashboard)/layout.tsx" "app/(dashboard)/settings/page.tsx"
git commit -m "feat(settings): render settings as intercepting-route modal"
```

---

### Task 6: Verify in the running app + update docs

**Files:**
- Modify: `.claude/docs/page-specs.md` (Settings entry → describe the modal)

- [ ] **Step 1: Run the dev server and verify the flows**

Run: `npm run dev` (then exercise in the browser — note `npm run dev` hits the REMOTE Supabase).

Verify all of:
- Sidebar **Settings** opens the modal as an overlay over the current page (URL becomes `/settings`).
- Side-tabs switch sections; each tab updates `?tab=` and is the active item.
- **Privacy** and **Terms** tabs render the inline copy + canonical links.
- Existing tabs (Personal Info, Account, Plans & Billing, Receive Payments) render and save exactly as before.
- Close button, backdrop click, and `Esc` all close the modal and return to the previous page.
- Direct load / refresh of `/settings` shows the modal over the dashboard home.
- Legacy `/settings?tab=branding` → `/branding`; `/settings?tab=templates` → `/templates`.
- Mobile width (Pixel 5 / iPhone 12): nav collapses to the horizontal pill row; modal is full-bleed.
- No console errors.

- [ ] **Step 2: Update page-specs doc**

In `.claude/docs/page-specs.md`, update the Settings section to state that Settings now renders as an **overlay modal** (intercepting route at `/settings`) with a left side-tab nav and tabs: Personal Info, Account, Plans & Billing, Receive Payments, Privacy, Terms. Note the hard-load fallback (modal over dashboard) and preserved legacy redirects.

- [ ] **Step 3: Commit**

```bash
git add .claude/docs/page-specs.md
git commit -m "docs(settings): describe settings overlay modal"
```

---

## Self-Review

**Spec coverage:**
- Intercepting route + URL kept → Task 5 (`@modal/(.)settings`). ✅
- Hard-load = modal over dashboard → Task 5 Step 4 (`DashboardPage` + `SettingsModal`). ✅
- Modal shell matches couple-profile → Task 4 shell. ✅
- Side-tab nav with icons, 6 tabs → Task 1. ✅
- Existing sections reused unchanged → Task 3. ✅
- Inline Privacy/Terms with canonical links → Task 2. ✅
- Legacy redirects preserved → Task 4 (effect) + verified Task 6. ✅
- Sidebar unchanged → no task needed (intercept catches its `Link`). ✅
- Docs updated → Task 6. ✅

**Placeholder scan:** No TBD/TODO; all components shown in full. ✅

**Type consistency:** `SettingsTabId`, `SettingsData`, `UserMetadata`, `EntitlementSource` defined in Tasks 1/3 and consumed with matching names in Tasks 3/4. `SETTINGS_NAV_ITEMS` / `SettingsNav` / `handleTabChange(SettingsTabId)` consistent. ✅

## Open items (carried from spec)
1. **Legal text fidelity** — copy in Task 2 mirrors the published pages but was reconstructed from an automated fetch; confirm verbatim before treating as the legal source of truth. Canonical link is rendered alongside.
2. **Section styling** — existing section components keep their legacy `gray-*` styling; token retrofit is out of scope.
