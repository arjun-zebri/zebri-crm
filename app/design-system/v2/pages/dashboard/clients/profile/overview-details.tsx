'use client';

import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';

import type { Fact, Person, Tone } from './profile-data';

/**
 * The Overview's right column: everything worth knowing about the
 * client at a glance. Details as label and value rows, where a value
 * that needs attention takes its colour (missing in red, waiting in
 * amber); the people, each with call, message and email; then notes.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/overview-details
 */

// Dark enough amber for text on white, as in the timeline.
const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-danger',
  warning: 'text-warning-ink',
};

export interface OverviewDetailsProps {
  facts: Fact[];
  people: Person[];
  notes: string;
}

/** The right column. See {@link OverviewDetailsProps}. */
export function OverviewDetails({ facts, people, notes }: OverviewDetailsProps) {
  return (
    <div className="space-y-10">
      <Group title="Details">
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-3.5 type-body">
          {facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-zebra-500">{f.label}</dt>
              <dd className={f.tone ? TONE_TEXT[f.tone] : 'text-zebra-950'}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </Group>
      <Group title="People">
        <ul className="space-y-4">
          {people.map((p) => (
            <PersonRow key={p.name} person={p} />
          ))}
        </ul>
      </Group>
      {notes ? (
        <Group title="Notes">
          <p className="type-body text-zebra-950">{notes}</p>
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4">
      <h3 className="type-label font-semibold text-zebra-950">{title}</h3>
      {children}
    </section>
  );
}

/** A person: name, who they are and how they like to be reached, then three ways to reach them. */
function PersonRow({ person }: { person: Person }) {
  const first = person.name.split(' ')[0] ?? person.name;
  // Australian mobile to international form for wa.me: 0412… → 61412….
  const digits = person.phone.replace(/\D/g, '').replace(/^0/, '61');
  const ways: { label: string; icon: LucideIcon; href: string }[] = [
    { label: `Call ${first}`, icon: Phone, href: `tel:${person.phone.replace(/\s/g, '')}` },
    { label: `Message ${first}`, icon: MessageCircle, href: `https://wa.me/${digits}` },
    { label: `Email ${first}`, icon: Mail, href: `mailto:${person.email}` },
  ];
  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1 type-body">
        <p className="type-label text-zebra-950">{person.name}</p>
        <p className="truncate text-zebra-500">
          {person.role} · {person.prefers}
        </p>
      </div>
      {/* -mr-2 puts the last icon's glyph on the column's right edge. */}
      <span className="-mr-2 flex shrink-0">
        {ways.map(({ label, icon: Icon, href }) => (
          <Button
            key={label}
            variant="ghost"
            square
            aria-label={label}
            title={label}
            onClick={() => window.open(href, '_blank', 'noopener')}
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        ))}
      </span>
    </li>
  );
}
