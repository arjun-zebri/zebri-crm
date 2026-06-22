/**
 * "Public Page" settings section. Groups the outward-facing branding an
 * MC's couples see: the Zebri subdomain that fronts the portal, invoices,
 * quotes, and contracts, plus (in the {@link PublicPageEmail} subsection)
 * the address that emails are sent from.
 *
 * State is persisted to `user_public_settings`: the subdomain auto-saves
 * on blur via {@link saveSubdomainAction}, and the email subsection drives
 * its own server actions. The subdomain is a stored preference today —
 * routing `name.zebri.com.au` to the app is a separate infra task, so the
 * "Where it's used" list previews the address without it being live yet.
 *
 * @module app/(dashboard)/settings/public-page-section
 */
'use client';

import {
  FileSignature,
  Globe,
  Receipt,
  ScrollText,
  Users2,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { normalizeSubdomain } from '@/lib/settings/public-page';

import { AutoSaveStatus, type SaveState } from './auto-save-status';
import { saveSubdomainAction } from './public/actions';
import { PublicPageEmail } from './public-page-email';
import type { PublicSettingsData } from './settings-body';

/** Root domain every MC subdomain hangs off. */
const ROOT_DOMAIN = 'zebri.com.au';

interface PublicPageSectionProps {
  /**
   * Seed used to suggest a default subdomain when none is saved yet,
   * typically the business name, falling back to the display name.
   */
  seedName: string;
  /** Persisted Public Page settings, or null when nothing is saved yet. */
  initial: PublicSettingsData | null;
}

/** A single outward-facing surface and the path the subdomain fronts. */
interface SurfaceDef {
  id: string;
  label: string;
  icon: typeof Globe;
  /** Builds the displayed URL from the resolved host. */
  build: (host: string) => string;
}

const SURFACES: SurfaceDef[] = [
  { id: 'portal', label: 'Couple portal', icon: Users2, build: (h) => `${h}/portal/emma-and-james` },
  { id: 'invoices', label: 'Invoices', icon: Receipt, build: (h) => `${h}/i/INV-1042` },
  { id: 'quotes', label: 'Quotes', icon: ScrollText, build: (h) => `${h}/q/QTE-1042` },
  { id: 'contracts', label: 'Contracts', icon: FileSignature, build: (h) => `${h}/c/CON-1042` },
];

export function PublicPageSection({ seedName, initial }: PublicPageSectionProps) {
  const [subdomain, setSubdomain] = useState(
    () => initial?.subdomain || normalizeSubdomain(seedName) || 'your-business',
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  // Last value we successfully persisted, so a blur with no change is a no-op.
  const savedRef = useRef(initial?.subdomain ?? '');

  const host = `${subdomain || 'your-business'}.${ROOT_DOMAIN}`;

  // Persist the subdomain on blur. No-op when unchanged; errors (invalid
  // or taken) surface inline rather than as a toast.
  const handleSubdomainBlur = async () => {
    if (subdomain === savedRef.current) return;
    setSaveState('saving');
    setSubdomainError(null);
    const result = await saveSubdomainAction({ subdomain });
    if (result.ok) {
      setSubdomain(result.subdomain);
      savedRef.current = result.subdomain;
      setSaveState('saved');
    } else {
      setSubdomainError(result.error);
      setSaveState('error');
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-gray-900">Public page</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Your branded web address, used everywhere your couples see you.
        </p>
      </div>

      {/* Subdomain editor */}
      <div>
        <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
          Your Zebri address
        </label>
        <div className="flex items-stretch max-w-xl">
          <input
            id="subdomain"
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(normalizeSubdomain(e.target.value))}
            onBlur={handleSubdomainBlur}
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 border border-gray-200 rounded-l-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
            placeholder="your-business"
          />
          <span className="flex items-center px-3 text-sm text-gray-400 bg-gray-50 border border-l-0 border-gray-200 rounded-r-xl whitespace-nowrap select-none">
            .{ROOT_DOMAIN}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 h-5">
          <p className="text-xs text-gray-400">
            {subdomainError ?? 'Letters, numbers and hyphens only.'}
          </p>
          <AutoSaveStatus state={saveState} />
        </div>

        {/* Where the subdomain shows up */}
        <h3 className="mt-6 text-sm font-medium text-gray-700 mb-1">Where it&rsquo;s used</h3>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {SURFACES.map((surface) => {
            const Icon = surface.icon;
            return (
              <div key={surface.id} className="flex items-center gap-3 py-3">
                <Icon size={18} strokeWidth={1.5} className="shrink-0 text-gray-400" />
                <span className="text-sm text-gray-700 w-28 shrink-0">{surface.label}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-500">
                  {surface.build(host)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email sending address */}
      <PublicPageEmail initial={initial} />
    </div>
  );
}
