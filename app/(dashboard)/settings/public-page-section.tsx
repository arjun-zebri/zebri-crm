/**
 * "Public Page" settings section. Groups the outward-facing branding an
 * MC's couples see: the Zebri subdomain that fronts the portal, invoices,
 * quotes, and contracts, plus the address that emails are sent from.
 *
 * Email model: by default mail is sent from a shared Zebri address
 * (no-reply@zebri.com.au). MCs who own a domain can send from it instead
 * (e.g. hello@yourbusiness.com.au) with no Zebri branding, once they add
 * the DNS records and verify ownership.
 *
 * UI ONLY for now: every field lives in local state and nothing is
 * persisted. There is no migration, DB column, domain verification, or
 * `updateUser()` write behind it yet.
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
import { useState } from 'react';

/** Root domain every MC subdomain hangs off. */
const ROOT_DOMAIN = 'zebri.com.au';

/** Fallback sending address used when an MC has no verified domain. */
const DEFAULT_FROM = 'no-reply@zebri.com.au';

interface PublicPageSectionProps {
  /**
   * Seed used to suggest a default subdomain when none is set yet,
   * typically the business name, falling back to the display name.
   */
  seedName: string;
}

/**
 * Slugify a free-text name into a valid subdomain candidate: lowercase,
 * hyphen-separated, alphanumerics plus hyphens only, no leading,
 * trailing, or doubled hyphens.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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

/** Where the MC sends mail from. */
type EmailMode = 'zebri' | 'custom';

/** Example DNS records an MC would add to verify a custom domain. */
const DNS_RECORDS = [
  { type: 'TXT', name: '@', value: 'v=spf1 include:zebri.com.au ~all' },
  { type: 'TXT', name: 'resend._domainkey', value: 'p=MIGfMA0GCSqGSIb3DQEB... (shown after you add the domain)' },
  { type: 'MX', name: 'send', value: 'feedback-smtp.zebri.com.au (priority 10)' },
];

export function PublicPageSection({ seedName }: PublicPageSectionProps) {
  const [subdomain, setSubdomain] = useState(() => slugify(seedName) || 'your-business');
  const [emailMode, setEmailMode] = useState<EmailMode>('zebri');
  const [emailDomain, setEmailDomain] = useState('');

  const host = `${subdomain || 'your-business'}.${ROOT_DOMAIN}`;
  const customFrom = `hello@${emailDomain || 'yourbusiness.com.au'}`;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Public page</h2>
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
            onChange={(e) => setSubdomain(slugify(e.target.value))}
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 border border-gray-200 rounded-l-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
            placeholder="your-business"
          />
          <span className="flex items-center px-3 text-sm text-gray-400 bg-gray-50 border border-l-0 border-gray-200 rounded-r-xl whitespace-nowrap select-none">
            .{ROOT_DOMAIN}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">Letters, numbers and hyphens only.</p>

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
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Email</h3>
        <p className="text-xs text-gray-400 mb-3">Where the emails you send to couples come from.</p>

        <div className="space-y-2 max-w-xl">
          <EmailOption
            selected={emailMode === 'zebri'}
            onSelect={() => setEmailMode('zebri')}
            title="Send from Zebri"
            description={`${DEFAULT_FROM}. Works instantly, no setup.`}
          />
          <EmailOption
            selected={emailMode === 'custom'}
            onSelect={() => setEmailMode('custom')}
            title="Use my own domain"
            description={`Send from your own address, e.g. ${customFrom}. No Zebri branding.`}
          />
        </div>

        {emailMode === 'custom' && (
          <div className="mt-4 pl-7 max-w-xl space-y-4">
            <div className="flex items-stretch gap-2">
              <input
                id="email-domain"
                type="text"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value.trim().toLowerCase())}
                spellCheck={false}
                autoCapitalize="none"
                className="min-w-0 flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
                placeholder="yourbusiness.com.au"
              />
              <button
                type="button"
                className="shrink-0 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition cursor-pointer"
              >
                Verify
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-gray-500">Not verified. Add the records below, then verify.</span>
            </div>

            {/* DNS records to add */}
            <div className="rounded-xl bg-gray-50 divide-y divide-gray-100">
              {DNS_RECORDS.map((record) => (
                <div key={`${record.type}-${record.name}`} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="w-10 shrink-0 font-mono text-xs font-medium text-gray-500">
                    {record.type}
                  </span>
                  <span className="w-36 shrink-0 break-all font-mono text-xs text-gray-600">
                    {record.name}
                  </span>
                  <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-500">
                    {record.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EmailOptionProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

/** A selectable radio-style row for choosing the email sending mode. */
function EmailOption({ selected, onSelect, title, description }: EmailOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 text-left cursor-pointer"
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
          selected ? 'border-gray-900' : 'border-gray-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-gray-900" />}
      </span>
      <span>
        <span className="block text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-400">{description}</span>
      </span>
    </button>
  );
}
