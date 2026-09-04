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

import { useScrollLock } from '@/components/ui/use-overlay';
import { createClient } from '@/lib/supabase/client';

import { OAUTH_RETURN_FLAG } from './public-page-email';
import {
  SettingsBody,
  type EntitlementSource,
  type PublicSettingsData,
  type SettingsData,
  type UserMetadata,
} from './settings-body';
import { SETTINGS_NAV_ITEMS, SettingsNav, type SettingsTabId } from './settings-nav';

const VALID_TABS = SETTINGS_NAV_ITEMS.map((i) => i.key) as SettingsTabId[];

export function SettingsModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsData | null>(null);

  // The active tab is LOCAL state, seeded once from `?tab=` so deep
  // links open the right section. It is deliberately NOT driven by the
  // router: this modal renders inside an intercepting route, and a
  // same-route `router.replace('/settings?tab=…')` on every tab click
  // re-resolves the route tree and bounces back to the underlying page
  // (remounting the modal and resetting the tab). Local state mirrors
  // the working `couple-profile` overlay, which never navigates on a
  // tab change.
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    rawTab && VALID_TABS.includes(rawTab as SettingsTabId)
      ? (rawTab as SettingsTabId)
      : 'personal-info',
  );

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

      // Public Page settings live in their own RLS-owned table; load the
      // row alongside the user so the section renders the saved state.
      let publicSettings: PublicSettingsData | null = null;
      if (user) {
        // Note: the encrypted OAuth tokens are deliberately NOT selected —
        // the client never needs (or should see) them.
        const { data: row } = await supabase
          .from('user_public_settings')
          .select(
            'subdomain, email_mode, oauth_provider, oauth_email, oauth_status, mc_signature_image',
          )
          .eq('user_id', user.id)
          .maybeSingle();
        if (row) {
          publicSettings = {
            subdomain: row.subdomain,
            emailMode: row.email_mode === 'oauth' ? 'oauth' : 'zebri',
            oauthProvider: (row.oauth_provider as PublicSettingsData['oauthProvider']) ?? null,
            oauthEmail: row.oauth_email,
            oauthStatus: (row.oauth_status as PublicSettingsData['oauthStatus']) ?? 'none',
            mcSignatureImage: row.mc_signature_image,
          };
        }
      }

      setData({
        metadata: (user?.user_metadata as UserMetadata) ?? null,
        entitlements: user
          ? ({ app_metadata: user.app_metadata ?? {}, user_metadata: user.user_metadata ?? {} } as EntitlementSource)
          : null,
        email: user?.email ?? null,
        userCreatedAt: user?.created_at ?? null,
        publicSettings,
      });
    };
    load();
  }, []);

  // Close = pop history back to wherever the modal opened from; fall
  // back to the dashboard home if there's nothing to pop (hard load).
  const handleClose = () => {
    // Arriving via the mailbox-connect redirect leaves the provider's
    // consent screen as the previous history entry, so router.back()
    // would reopen it. PublicPageEmail sets a per-tab flag on that
    // return (sessionStorage, not state — this modal remounts when the
    // route re-resolves); consume it and navigate forward instead.
    let returnedFromOAuth = false;
    try {
      returnedFromOAuth = sessionStorage.getItem(OAUTH_RETURN_FLAG) === '1';
      if (returnedFromOAuth) sessionStorage.removeItem(OAUTH_RETURN_FLAG);
    } catch {
      // Storage unavailable — fall back to history navigation.
    }
    if (returnedFromOAuth || window.history.length <= 1) router.push('/');
    else router.back();
  };

  // Shared count rather than a local overflow write, so a confirm dialog
  // raised from a settings section cannot unlock the page behind it.
  useScrollLock(true);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (id: SettingsTabId) => {
    setActiveTab(id);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" onClick={handleClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4" onClick={handleClose}>
        <div
          data-testid="settings-panel"
          className="bg-surface rounded-control shadow-xl w-full sm:w-[90vw] sm:max-w-[1100px] h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border shrink-0">
            <h1 className="text-section font-semibold text-text">Settings</h1>
            <button
              onClick={handleClose}
              className="p-1.5 text-text-subtle hover:text-gray-600 transition cursor-pointer"
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
                  <div className="h-9 bg-surface-emphasis rounded-control w-full" />
                  <div className="h-9 bg-surface-emphasis rounded-control w-full" />
                  <div className="h-9 bg-surface-emphasis rounded-control w-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
