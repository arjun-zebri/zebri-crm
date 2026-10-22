'use client';

import { Badge } from '@/components/ui-v2/badge';
import { DateField } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Input } from '@/components/ui-v2/input';
import { Tooltip } from '@/components/ui-v2/tooltip';

import { SettingsSection } from '../../enquiries/settings/pane-parts';
import { CELEBRANT_CODES, CELEBRANT_TYPES, RITES, STATES, TITLES } from '../bdm-data';
import { patchCelebrant, useCelebrant } from '../bdm-store';
import { AU_STATES } from '../reference';

/**
 * The Lodge with BDM tab of Settings, where adding the block lands: the
 * celebrant's registration as the Registry holds it (eRegistry's
 * "Celebrant's Details"), set once and put on every lodgement, so no
 * couple's paperwork asks for it again. Which states can lodge sits at
 * the top (NSW now, the rest coming), and the eRegistry username at the
 * foot, with the one line on why the password is never kept. Saves as
 * it is typed. Each field is a ledger row, as Business's (2026-10-15):
 * its name in grey on the left, the value beside it, no icons.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/settings/celebrant-tab
 */

/** A list of words as a dropdown's options. */
const opts = (words: readonly string[]) => words.map((w) => ({ value: w, label: w }));
export function CelebrantTab() {
  const c = useCelebrant();
  return (
    <div className="space-y-8">
      <SettingsSection
        title="Where you lodge"
        why="Zebri lodges straight with the Registry in New South Wales. The other states are on their way."
      >
        <ul className="flex flex-wrap gap-2" aria-label="States">
          {STATES.map((s) => (
            <li key={s.id}>
              <Badge tone={s.live ? 'brand' : 'neutral'} className="gap-1.5">
                <Tooltip label={s.name}>
                  <span>{s.id}</span>
                </Tooltip>
                <span className={s.live ? '' : 'text-zebra-400'}>{s.live ? 'Live' : 'Soon'}</span>
              </Badge>
            </li>
          ))}
        </ul>
      </SettingsSection>
      <SettingsSection
        title="Your registration"
        why="As it reads on the Register of Marriage Celebrants. It goes on every marriage you lodge, so it has to match exactly."
      >
        <div>
          <Dropdown
            row
            label="Celebrant code"
            options={opts(CELEBRANT_CODES)}
            value={c.code}
            onChange={(code) => patchCelebrant({ code })}
          />
          <Input
            row
            label="Registration number"
            inputMode="numeric"
            value={c.number}
            onChange={(e) => patchCelebrant({ number: e.target.value })}
          />
          <Dropdown
            row
            label="Title"
            options={opts(TITLES)}
            value={c.title}
            onChange={(title) => patchCelebrant({ title })}
          />
          <Input
            row
            label="Family name"
            value={c.familyName}
            onChange={(e) => patchCelebrant({ familyName: e.target.value })}
          />
          <Input
            row
            label="First given name"
            value={c.givenName}
            onChange={(e) => patchCelebrant({ givenName: e.target.value })}
          />
          <Input
            row
            label="Other given names"
            value={c.otherNames}
            onChange={(e) => patchCelebrant({ otherNames: e.target.value })}
          />
          <Dropdown
            row
            label="Celebrant type"
            options={opts(CELEBRANT_TYPES)}
            value={c.type}
            onChange={(type) => patchCelebrant({ type })}
          />
          <Input
            row
            label="Denomination"
            value={c.denomination}
            onChange={(e) => patchCelebrant({ denomination: e.target.value })}
          />
          <Dropdown
            row
            label="Rites"
            options={opts(RITES)}
            value={c.rites}
            onChange={(rites) => patchCelebrant({ rites })}
          />
          <DateField
            row
            label="Date of appointment"
            value={c.appointed}
            onChange={(appointed) => patchCelebrant({ appointed })}
          />
          <DateField
            row
            label="Date of birth"
            value={c.dateOfBirth}
            onChange={(dateOfBirth) => patchCelebrant({ dateOfBirth })}
          />
          <Input
            row
            label="Your email with BDM"
            type="email"
            // BDM writes to the contact it holds for the celebrant (guide §5.1); this field cannot redirect that, only record it.
            help="BDM sends its notices to the email on your eRegistry account. Put the same one here, so you know where to look."
            value={c.email}
            onChange={(e) => patchCelebrant({ email: e.target.value })}
          />
        </div>
      </SettingsSection>
      <SettingsSection
        title="Your postal address"
        why="Where a certificate you order goes, when you have it sent to you. No commas or slashes: the Registry refuses them."
      >
        <div>
          <Input
            row
            label="Street address"
            autoComplete="address-line1"
            value={c.postal.line1}
            onChange={(e) => patchCelebrant({ postal: { ...c.postal, line1: e.target.value } })}
          />
          <Input
            row
            label="Suburb or town"
            autoComplete="address-level2"
            value={c.postal.suburb}
            onChange={(e) => patchCelebrant({ postal: { ...c.postal, suburb: e.target.value } })}
          />
          <Dropdown
            row
            label="State"
            options={opts(AU_STATES)}
            value={c.postal.state}
            onChange={(state) => patchCelebrant({ postal: { ...c.postal, state } })}
          />
          <Input
            row
            label="Postcode"
            inputMode="numeric"
            autoComplete="postal-code"
            value={c.postal.postcode}
            onChange={(e) => patchCelebrant({ postal: { ...c.postal, postcode: e.target.value } })}
          />
        </div>
      </SettingsSection>
      <SettingsSection
        title="Your eRegistry login"
        why="Zebri remembers your username. Your password is asked for each time you lodge and never kept, so nobody can lodge in your name from here."
      >
        <Input
          row
          label="eRegistry username"
          autoComplete="username"
          value={c.username}
          onChange={(e) => patchCelebrant({ username: e.target.value })}
        />
      </SettingsSection>
    </div>
  );
}
