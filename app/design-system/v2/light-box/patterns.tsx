'use client';

import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import {
  CalendarIcon,
  CallIcon,
  ClientsIcon,
  EmailIcon,
  GuestsIcon,
  JourneysIcon,
  NotesIcon,
  PackageIcon,
  PaymentsIcon,
  SearchIcon,
  SourceIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Input } from '@/components/ui-v2/input';
import { PropertyChip } from '@/components/ui-v2/property-chip';

/**
 * The three ways premium apps lay out fields (Linear, Stripe, Vercel,
 * Attio), each shown on a real Zebri screen with its demo data
 * (2026-10-15): a form (Settings > Business, plus the one icon-in-a-box
 * case, the Clients search), a quick-create (New client), and a record
 * (Amelia & Jack's Overview). Mocks only: no primitive changes.
 *
 * @module app/design-system/v2/light-box/patterns
 */

const BOX =
  'rounded-button border border-zebra-200 bg-white transition-[border-color,box-shadow] duration-150 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-[3px] focus-within:ring-zebra-950/5 motion-reduce:transition-none';

/** A plain hairline field: name above, no icon, help under. */
function Plain({
  label,
  value = '',
  help,
  type,
}: {
  label: string;
  value?: string;
  help?: string;
  type?: string;
}) {
  const id = useId();
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block type-label text-zebra-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className={`block h-9 w-full px-3 type-body text-zebra-950 outline-none ${BOX}`}
      />
      {help ? <p className="type-body text-zebra-500">{help}</p> : null}
    </div>
  );
}

function Panel({
  n,
  title,
  like,
  where,
  children,
}: {
  n: number;
  title: string;
  like: string;
  where: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="type-heading text-zebra-950">
          {n}. {title}
        </h3>
        <p className="type-body text-zebra-500">
          Like {like}. In Zebri: {where}.
        </p>
      </div>
      {children}
    </section>
  );
}

const noop = () => undefined;
const chip = (icon: ZebriIcon, label: string, value?: string) => (
  <PropertyChip
    key={label}
    icon={icon}
    label={label}
    value={value}
    open={false}
    onOpenChange={noop}
  >
    {null}
  </PropertyChip>
);

/** 1. A form: Settings > Business, as it is filled in the demo account. */
function FormExample() {
  return (
    <div className="space-y-6">
      <div className="rounded-panel bg-white p-6 shadow-btn-soft ring-1 ring-hairline">
        <h4 className="type-subheading text-zebra-950">Your business</h4>
        <p className="mb-5 type-body text-zebra-500">
          Who couples are dealing with. These head and sign off every document and email you send.
        </p>
        <div className="max-w-md space-y-4">
          <Plain label="Business name" value="Arjun Punekar MC" help="Heads every document" />
          <Plain label="Your name" value="Arjun Punekar" help="Signs proposals and emails" />
          <Plain label="What you do" value="MC" help="Under your name" />
          <Plain
            label="Phone"
            type="tel"
            value="0400 123 456"
            help="On documents and your signature"
          />
          <Plain
            label="Email"
            type="email"
            value="hello@arjunmc.com.au"
            help="Where couples reply"
          />
          <Plain label="Website" type="url" help="In your signature" />
          <Plain label="ABN" value="51 824 753 556" help="On invoices and contracts" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="type-body text-zebra-500">
          The one place an icon sits inside a box: search (the Clients toolbar).
        </p>
        <div className="max-w-xs">
          <Input
            type="search"
            raised
            aria-label="Search clients"
            placeholder="Search clients"
            leading={<SearchIcon aria-hidden="true" className="size-4" />}
          />
        </div>
      </div>
    </div>
  );
}

/** 2. A quick-create: New client, as Linear's New issue does it. */
function QuickCreateExample() {
  const [names, setNames] = useState('Amelia & Jack');
  return (
    <div className="overflow-hidden rounded-panel bg-white shadow-btn-soft ring-1 ring-hairline">
      <DialogHeader
        id="pattern-new-client"
        title="New client"
        icon={ClientsIcon}
        closable={false}
      />
      <DialogBody className="flex flex-col gap-5 sm:pt-6">
        {/* The one big line: the thing being made, as Linear's issue title. */}
        <input
          aria-label="Names"
          placeholder="Names"
          value={names}
          onChange={(e) => setNames(e.target.value)}
          className="w-full bg-transparent type-title text-zebra-950 outline-none placeholder:text-zebra-300"
        />
        {/* Everything else is a property: empty, a quiet chip naming it; set, its value. */}
        <div className="-mx-2.5 flex flex-wrap gap-1">
          {chip(EmailIcon, 'Email', 'amelia@example.com')}
          {chip(CallIcon, 'Phone')}
          {chip(JourneysIcon, 'Journey', 'Wedding journey')}
          {chip(CalendarIcon, 'Event date', 'Sat 10 Oct 2026 · in 15 days')}
          {chip(VenueIcon, 'Venue', 'Hawthorn Hall')}
          {chip(GuestsIcon, 'Guests')}
          {chip(PackageIcon, 'Package')}
          {chip(SourceIcon, 'Found you via', 'Via Website form')}
        </div>
        <textarea
          aria-label="Notes"
          rows={4}
          placeholder="Add notes…"
          className="w-full resize-none bg-transparent type-body text-zebra-950 outline-none placeholder:text-zebra-400"
        />
      </DialogBody>
      <DialogFooter>
        <Button>Add client</Button>
      </DialogFooter>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ZebriIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="flex h-9 items-center gap-3 text-zebra-500">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="flex min-h-9 min-w-0 items-center">
        {/* Edited in place: the value tints on hover and opens its picker. */}
        <span className="-ml-2 cursor-pointer rounded-button px-2 py-1.5 text-zebra-950 transition-colors duration-150 hover:bg-hover motion-reduce:transition-none">
          {children}
        </span>
      </dd>
    </div>
  );
}

/** 3. A record: Amelia & Jack's Overview, as Linear's issue sidebar and Attio's record view. */
function RecordExample() {
  return (
    <div className="space-y-5 rounded-panel bg-white p-6 shadow-btn-soft ring-1 ring-hairline">
      <h4 className="type-subheading text-zebra-950">Amelia & Jack</h4>
      <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 type-body">
        <Row icon={JourneysIcon} label="Journey">
          Wedding · 5 of 7
        </Row>
        <Row icon={CalendarIcon} label="Date">
          Sat 10 Oct 2026
        </Row>
        <Row icon={VenueIcon} label="Venue">
          Hawthorn Hall
        </Row>
        <Row icon={PackageIcon} label="Package">
          Classic · $2,900
        </Row>
        <Row icon={PaymentsIcon} label="Paid">
          $1,450 · $1,450 due
        </Row>
        <Row icon={SourceIcon} label="Source">
          Website form
        </Row>
        <Row icon={EmailIcon} label="Amelia">
          amelia@example.com
        </Row>
        <Row icon={EmailIcon} label="Jack">
          jack@example.com
        </Row>
      </dl>
      <div className="flex gap-3 border-t border-hairline pt-4">
        <NotesIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zebra-500" />
        <p className="type-body text-zebra-950">
          Final numbers are due to the caterer Friday and they haven&rsquo;t confirmed.
        </p>
      </div>
    </div>
  );
}

/** The three patterns side by side. */
export function PremiumPatterns() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-3">
      <Panel
        n={1}
        title="Forms"
        like="Stripe, Linear and Vercel settings"
        where="log in, sign up, Settings"
      >
        <FormExample />
      </Panel>
      <Panel
        n={2}
        title="Quick-create"
        like="Linear's New issue, Attio's new record"
        where="New client"
      >
        <QuickCreateExample />
      </Panel>
      <Panel
        n={3}
        title="Records"
        like="Linear's issue sidebar, Attio's record view"
        where="a client's Overview"
      >
        <RecordExample />
      </Panel>
    </div>
  );
}
