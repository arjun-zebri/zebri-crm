'use client';

import { useId, useState, type ComponentType } from 'react';

import { Button } from '@/components/ui-v2/button';
import {
  BdmIcon,
  BriefcaseIcon,
  CallIcon,
  EmailIcon,
  GlobeIcon,
  LockIcon,
  MicIcon,
  UserIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';

import { ClientOverviewMock, NewClientMock } from './client-mocks';
import { PremiumPatterns } from './patterns';

/**
 * Live options for the v2 text field (user, 2026-10-15: "lets try a light
 * box", after option G's icon-only fields read badly). Each option keeps
 * the field's name visible above it and draws a light box, shown in the
 * three places fields live: log in, a settings form, and a quick-create
 * dialog. "Current (G)" is there to compare against. Self-contained: no
 * primitive changes until an option is picked.
 *
 * @module app/design-system/v2/light-box/page
 */

type Look = 'Hairline' | 'Soft fill' | 'Hairline + icons' | 'Current (G)';
const LOOKS: readonly Look[] = ['Hairline', 'Soft fill', 'Hairline + icons', 'Current (G)'];

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

/** The box per look: resting, hover and focus. */
const BOX: Record<Exclude<Look, 'Current (G)'>, string> = {
  Hairline:
    'bg-white border border-zebra-200 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-[3px] focus-within:ring-zebra-950/5',
  'Soft fill':
    'bg-zebra-100 border border-transparent hover:bg-zebra-200/70 focus-within:bg-white focus-within:border-zebra-300 focus-within:ring-[3px] focus-within:ring-zebra-950/5',
  'Hairline + icons':
    'bg-white border border-zebra-200 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-[3px] focus-within:ring-zebra-950/5',
};

interface FieldDef {
  label: string;
  icon: Icon;
  /** Whether the icon is obvious enough to show in "Hairline + icons". */
  plainIcon?: boolean;
  type?: string;
  value?: string;
  help?: string;
  error?: string;
  disabled?: boolean;
}

function BoxField({ look, f }: { look: Look; f: FieldDef }) {
  const id = useId();
  const [value, setValue] = useState(f.value ?? '');
  if (look === 'Current (G)') {
    return (
      <Input
        icon={f.icon}
        label={f.label}
        type={f.type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        help={f.help}
        error={f.error}
        disabled={f.disabled}
      />
    );
  }
  const Lead = look === 'Hairline + icons' && f.plainIcon ? f.icon : null;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block type-label text-zebra-700">
        {f.label}
      </label>
      <div
        className={`flex h-9 items-center gap-2 rounded-button px-3 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none ${BOX[look]}${f.error ? ' !border-danger' : ''}${f.disabled ? ' pointer-events-none opacity-50' : ''}`}
      >
        {Lead ? <Lead aria-hidden="true" className="size-4 shrink-0 text-zebra-400" /> : null}
        <input
          id={id}
          type={f.type}
          value={value}
          disabled={f.disabled}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={f.error ? true : undefined}
          aria-describedby={f.error || f.help ? `${id}-note` : undefined}
          className="h-full w-full min-w-0 bg-transparent type-body text-zebra-950 outline-none placeholder:text-zebra-400"
        />
      </div>
      {f.error || f.help ? (
        <p id={`${id}-note`} className={`type-body ${f.error ? 'text-danger' : 'text-zebra-500'}`}>
          {f.error ?? f.help}
        </p>
      ) : null}
    </div>
  );
}

function Stack({ look, fields }: { look: Look; fields: FieldDef[] }) {
  return (
    <div className={look === 'Current (G)' ? 'space-y-1' : 'space-y-4'}>
      {fields.map((f) => (
        <BoxField key={`${look}-${f.label}`} look={look} f={f} />
      ))}
    </div>
  );
}

function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`space-y-5 rounded-panel bg-white p-6 shadow-btn-soft ring-1 ring-hairline ${className}`}
    >
      <h2 className="type-subheading text-zebra-950">{title}</h2>
      {children}
    </section>
  );
}

const LOGIN: FieldDef[] = [
  { label: 'Email', icon: EmailIcon, plainIcon: true, type: 'email' },
  { label: 'Password', icon: LockIcon, plainIcon: true, type: 'password' },
];

const BUSINESS: FieldDef[] = [
  {
    label: 'Business name',
    icon: BriefcaseIcon,
    value: 'Jane Doe Celebrant',
    help: 'Heads every document',
  },
  { label: 'Your name', icon: UserIcon, value: 'Jane Doe' },
  { label: 'What you do', icon: MicIcon, value: 'Celebrant and MC' },
  { label: 'Phone', icon: CallIcon, plainIcon: true, type: 'tel', value: '0412 345 678' },
  {
    label: 'Email',
    icon: EmailIcon,
    plainIcon: true,
    type: 'email',
    value: 'jane@',
    error: 'Enter a valid email address.',
  },
  { label: 'Website', icon: GlobeIcon, plainIcon: true, type: 'url' },
  {
    label: 'ABN',
    icon: BdmIcon,
    value: '12 345 678 901',
    disabled: true,
    help: 'Locked once an invoice has been sent',
  },
];

const NEW_CLIENT: FieldDef[] = [
  { label: 'Names', icon: UserIcon, value: 'Sophie & James' },
  { label: 'Email', icon: EmailIcon, plainIcon: true, type: 'email' },
  { label: 'Phone', icon: CallIcon, plainIcon: true, type: 'tel' },
  { label: 'Venue', icon: VenueIcon, plainIcon: true, value: 'Stones of the Yarra Valley' },
];

/** The options page. */
export default function LightBoxOptionsPage() {
  const [look, setLook] = useState<Look>('Hairline');
  const [sheet, setSheet] = useState<'Property sheet' | 'Boxed'>('Property sheet');
  return (
    <main className="min-h-screen bg-zebra-50 px-4 py-10 md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-6 border-b border-hairline pb-10">
          <div className="space-y-2">
            <h1 className="type-title text-zebra-950">How premium apps lay out fields</h1>
            <p className="max-w-3xl type-body text-zebra-600">
              Three patterns, each on a real Zebri screen with the demo account&rsquo;s data. Forms
              get a name above a plain hairline box; a quick-create is one big line plus property
              chips; a record is a property sheet edited in place. Icons go in the label column or
              chips, never inside a form box (search aside).
            </p>
          </div>
          <PremiumPatterns />
        </section>
        <header className="space-y-3">
          <h2 className="type-title text-zebra-950">Text fields: light box options</h2>
          <p className="max-w-2xl type-body text-zebra-600">
            Each option keeps the name above the field and draws a light box. Hover, click in and
            type to feel it. The business form shows a help line, an error and a disabled field.
          </p>
          <Segmented label="Field look" options={LOOKS} value={look} onChange={setLook} />
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card title="Welcome back">
            <Stack look={look} fields={LOGIN} />
            <Button className="w-full">Log in</Button>
          </Card>
          <Card title="Your business">
            <Stack look={look} fields={BUSINESS} />
          </Card>
          <Card title="New client">
            <Stack look={look} fields={NEW_CLIENT} />
            <div className="flex justify-end">
              <Button>Add client</Button>
            </div>
          </Card>
        </div>
        <section className="space-y-4 border-t border-hairline pt-10">
          <h2 className="type-heading text-zebra-950">Hairline + icons, everywhere</h2>
          <p className="max-w-2xl type-body text-zebra-600">
            The consistent rule: every typed field is a hairline box, its name above and its icon
            inside. New client below follows it fully. For a client&rsquo;s Overview, compare boxing
            every detail with keeping the property sheet, which already shows each detail&rsquo;s
            icon and name.
          </p>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <NewClientMock />
            <div className="space-y-3">
              <Segmented
                label="Overview look"
                options={['Property sheet', 'Boxed'] as const}
                value={sheet}
                onChange={setSheet}
              />
              <ClientOverviewMock boxed={sheet === 'Boxed'} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
