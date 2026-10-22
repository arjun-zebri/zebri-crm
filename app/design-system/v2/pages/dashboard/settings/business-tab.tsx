'use client';

import { Input } from '@/components/ui-v2/input';

import { useAccount } from '../account';
import { useBrandKit } from '../brand/brand-provider';
import type { KitDetails } from '../brand/kit';
import { SettingsSection } from '../enquiries/settings/pane-parts';
import { MC } from '../proposals/templates-data';

/**
 * Settings > Business (founder, 2026-10-11: moved out of the brand kit,
 * since an ABN or a phone number is not branding and every other CRM
 * keeps them in Settings). The business's name, the MC's own name and
 * role, and how couples reach them, which head and sign off every
 * document and email. Ledger rows (2026-10-15 ruling): each field's
 * name on the left, its value beside it, no icons and no line under each
 * one (the section's one sentence says what they are for). Saved into
 * the brand kit's `details`, which the
 * brand provider serves as the account, so every page follows.
 *
 * @module app/design-system/v2/pages/dashboard/settings/business-tab
 */

const FIELDS: { key: keyof KitDetails; label: string; type?: 'email' | 'tel' | 'url' }[] = [
  { key: 'business', label: 'Business name' },
  { key: 'name', label: 'Your name' },
  { key: 'role', label: 'What you do' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'abn', label: 'ABN' },
];

/** The tab. */
export function BusinessTab() {
  const { kit, saveKit } = useBrandKit();
  const { business, mc, contact } = useAccount();
  // What the account says until the MC changes one here.
  const details: KitDetails = kit.details ?? {
    business,
    name: mc?.name ?? MC.name,
    role: mc?.role ?? 'MC',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    abn: contact?.abn ?? '',
    website: '',
  };
  return (
    <SettingsSection
      title="Your business"
      why="Who couples are dealing with. These head and sign off every document and email you send."
    >
      <div>
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            row
            label={f.label}
            type={f.type}
            autoComplete="off"
            value={details[f.key] ?? ''}
            onChange={(e) => saveKit({ ...kit, details: { ...details, [f.key]: e.target.value } })}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
