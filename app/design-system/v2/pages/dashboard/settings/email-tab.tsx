'use client';

import { useState } from 'react';

import { EmailIcon } from '@/components/ui-v2/icons';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import { useBrandKit } from '../brand/brand-provider';
import { DEFAULT_EMAIL, emailHeaderOf, type KitEmail } from '../brand/kit';
import { SettingsSection } from '../enquiries/settings/pane-parts';

import { useOwnSignature } from './own-signature';
import { SignatureEditor } from './signature-editor';

/**
 * Settings > Email (founder, 2026-10-11: out of the brand kit, and the
 * sign-off setting dropped). The signature, written as production's is
 * (user, 2026-10-15): a rich-text block the MC writes themselves
 * (`SignatureEditor`), started from their Business details, kept by
 * Settings' Save. Then what heads every email: one choice, so it is
 * a `PropertyChip` that says its value ("Logo at the top").
 *
 * @module app/design-system/v2/pages/dashboard/settings/email-tab
 */

const HEADERS: { value: NonNullable<KitEmail['header']>; label: string }[] = [
  { value: 'name', label: 'Business name' },
  { value: 'logo', label: 'Logo' },
  { value: 'none', label: 'Nothing' },
];

/** The tab. */
export function EmailTab() {
  const { kit, saveKit } = useBrandKit();
  const own = useOwnSignature();
  const mail = kit.email ?? DEFAULT_EMAIL;
  const set = (patch: Partial<KitEmail>) => saveKit({ ...kit, email: { ...mail, ...patch } });
  const [picking, setPicking] = useState(false);
  const header = HEADERS.find((h) => h.value === emailHeaderOf(kit));
  return (
    <div className="space-y-8">
      <SettingsSection
        title="Signature"
        why="The sign-off added to your emails: your name, business and any links."
      >
        <SignatureEditor value={own.value} onChange={own.save} />
      </SettingsSection>
      <SettingsSection title="Top of every email" why="What couples see first when they open one.">
        <div className="-mx-2.5">
          <PropertyChip
            icon={EmailIcon}
            label="At the top"
            value={
              header
                ? header.value === 'none'
                  ? 'Nothing at the top'
                  : `${header.label} at the top`
                : undefined
            }
            open={picking}
            onOpenChange={setPicking}
            size="menu"
          >
            {HEADERS.map((h) => (
              <MenuOption
                key={h.value}
                selected={emailHeaderOf(kit) === h.value}
                onSelect={() => {
                  set({ header: h.value });
                  setPicking(false);
                }}
              >
                {h.label}
              </MenuOption>
            ))}
          </PropertyChip>
        </div>
      </SettingsSection>
    </div>
  );
}
