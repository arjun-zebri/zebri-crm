'use client';

import { useState } from 'react';

import { FitInput } from '@/components/ui-v2/fit-input';
import { ClientsIcon, JourneysIcon, NotesIcon, UserIcon, UserPlusIcon } from '@/components/ui-v2/icons';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { Textarea } from '@/components/ui-v2/textarea';

import { useAccount } from '../../account';
import type { Journey } from '../../journeys/journeys-data';
import { useJourneys } from '../../journeys/use-journeys';
import type { Client } from '../clients-data';

import { isField, OverviewField } from './overview-fields';
import { factIcon, factTone, JourneyValue, PeopleChips, PropertyRow } from './overview-rows';
import type { Fact, Person } from './profile-data';
import { GUTTER, TOP } from './profile-header';

/**
 * The Overview: one sheet of everything about the client, as icon,
 * label and value rows (who they are: their Primary contact and
 * Secondary contact, typed in place, which rename the client everywhere
 * (`use-client-names.ts`); their journey and where they are on it, the
 * date, venue, package, what is paid, anyone else involved), then the notes under
 * a hairline, with their own icon. A value that needs attention takes its
 * colour ("Missing" in red) until it is changed.
 *
 * Everything the MC knows is edited in place, the way New client enters
 * it (`overview-fields.tsx`): each detail is plain text that tints on
 * hover and opens its picker, the journey is New client's journey menu
 * (moving them to another journey's first step), and notes are typed
 * straight in. What Zebri
 * works out from elsewhere stays read-only: Paid comes from their
 * invoices, Run sheet from the run sheet.
 *
 * Built exactly to the founder's 2026-10-09 mockup: no to-do cards and
 * no timeline here. Home is where the MC acts on what needs them.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/overview-section
 */

export interface OverviewSectionProps {
  client: Client;
  /** "Amelia & Jack". */
  who: string;
  /** The Primary and Secondary contact as typed. */
  names: [string, string];
  onNames: (names: [string, string]) => void;
  /** The people besides the contacts (a venue coordinator, a best man); the People row lists them. */
  others: Person[];
  /** The details as the MC has edited them this visit; held by the profile so a change outlasts a switch of section. */
  facts: Fact[];
  onFact: (label: string, value: string) => void;
  notes: string;
  onNotes: (notes: string) => void;
}

/** The journey this client is on, the step they are at (from 1), how many steps, and that step's name. */
function placeOf(journeys: Journey[], id: string) {
  for (const j of journeys) {
    const person = j.people.find((p) => p.id === id);
    if (!person) continue;
    const at = j.steps.findIndex((s) => s.id === person.step);
    if (at === -1) continue;
    return { id: j.id, name: j.name, at: at + 1, total: j.steps.length, next: j.steps[at]!.name };
  }
  return null;
}

/** The Overview section. See {@link OverviewSectionProps}. */
export function OverviewSection({
  client,
  who,
  names,
  onNames,
  others,
  facts,
  onFact,
  notes,
  onNotes,
}: OverviewSectionProps) {
  const state = useJourneys(useAccount().journeys);
  const place = placeOf(state.journeys, client.id);
  const [picking, setPicking] = useState(false);
  const move = (id: string | null) => {
    setPicking(false);
    if (!id) return state.removePerson(client.id);
    const first = state.journeys.find((j) => j.id === id)?.steps[0];
    if (first) state.addPerson(id, { id: client.id, name: who, step: first.id });
  };
  // New client's journey chip, quiet: plain text that tints on hover. The
  // -ml-2.5 takes back its padding so the name lines up with the rows'.
  const journeyMenu = (
    <div className="-ml-2.5">
      <PropertyChip
        quiet
        label="Journey"
        value={place?.name ?? 'No journey'}
        open={picking}
        onOpenChange={setPicking}
        size="menu"
      >
        {state.journeys.map((j) => (
          <MenuOption key={j.id} selected={place?.id === j.id} onSelect={() => move(j.id)}>
            {j.name}
          </MenuOption>
        ))}
        <MenuOption selected={!place} onSelect={() => move(null)}>
          No journey
        </MenuOption>
      </PropertyChip>
    </div>
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-[fade-in_200ms_ease-out_both]">
      <div className={`pb-28 ${TOP} ${GUTTER}`}>
        <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-6 type-body md:grid-cols-[10rem_minmax(0,1fr)]">
          {/* Who the client is, first: the title above reads from these. */}
          {(['Primary contact', 'Secondary contact'] as const).map((label, i) => (
            <PropertyRow key={label} icon={i ? UserPlusIcon : UserIcon} label={label}>
              <FitInput
                aria-label={label}
                placeholder="Add"
                value={names[i] ?? ''}
                onChange={(e) =>
                  onNames(i ? [names[0], e.target.value] : [e.target.value, names[1]])
                }
                textClassName="type-body text-zebra-950"
                className="-ml-2"
              />
            </PropertyRow>
          ))}
          <PropertyRow icon={JourneysIcon} label="Journey">
            {place ? <JourneyValue {...place} name={journeyMenu} /> : journeyMenu}
          </PropertyRow>
          {facts.map((f) => (
            <PropertyRow key={f.label} icon={factIcon(f)} label={f.label}>
              {isField(f) ? (
                <OverviewField fact={f} onChange={(v) => onFact(f.label, v)} />
              ) : (
                <span className={factTone(f)}>{f.value}</span>
              )}
            </PropertyRow>
          ))}
          {others.length ? (
            <PropertyRow icon={ClientsIcon} label="People">
              <PeopleChips people={others} />
            </PropertyRow>
          ) : null}
        </dl>
        {/* Always shown, so every client has a place for a note, not only those with one. */}
        <section
          aria-label="Notes"
          className="mt-6 flex gap-3 border-t border-hairline pt-6 type-body"
        >
          {/* mt-2 centres it on the note's first line: the textarea's 6px inset plus half its 20px line. */}
          <NotesIcon
            aria-hidden="true"
            className="mt-2 size-4 shrink-0 text-zebra-500"
          />
          <div className="min-w-0 flex-1">
            <Textarea
              bare
              grow
              aria-label="Notes"
              placeholder="Add a note about them"
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
