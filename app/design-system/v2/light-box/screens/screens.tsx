'use client';

import { use, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { FitInput } from '@/components/ui-v2/fit-input';
import {
  BdmIcon,
  BuildingIcon,
  ChevronDownIcon,
  CalendarClockIcon,
  CalendarIcon,
  ClientsIcon,
  EmailIcon,
  EnquiriesIcon,
  GuestsIcon,
  JourneysIcon,
  PackageIcon,
  SettingsIcon,
  SourceIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { TextLink } from '@/components/ui-v2/text-link';

import { AuthShell } from '../../pages/auth-shell';
import { SocialButtons } from '../../pages/social-buttons';

import { DialogCard, DirectionContext, EmptyContext, F, Group } from './field-kit';

/**
 * Full-size screens in the proposed field style, each built from its
 * real shell (AuthShell, the Settings split dialog, New client's lg
 * dialog) with the demo account's data. Mocks only.
 *
 * @module app/design-system/v2/light-box/screens/screens
 */

/**
 * Log in and sign up keep the hairline box in every direction (user,
 * 2026-10-15: "add borders to the login/sign up page and leave the rest
 * as is"): the first screen anyone sees, where a box says "type here"
 * with no learning, and password managers expect one.
 */
function AuthForm({ signup }: { signup: boolean }) {
  return (
    <DirectionContext value="boxed">
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <Group>
          <F
            label="Email"
            type="email"
            value="hello@arjunmc.com.au"
            placeholder="you@example.com"
            className="sm:col-span-2"
          />
          <F
            label="Password"
            kind="password"
            value="correct-horse"
            help={signup ? 'At least 8 characters.' : undefined}
            aside={signup ? undefined : <TextLink href="#">Forgot?</TextLink>}
            className="sm:col-span-2"
          />
        </Group>
        {signup ? null : <Checkbox label="Remember me" name="remember" />}
        <Button type="submit" className="w-full">
          {signup ? 'Create account' : 'Log in'}
        </Button>
      </form>
    </DirectionContext>
  );
}

export function LoginScreen() {
  return (
    <AuthShell
      contained
      title="Welcome back"
      footer={
        <>
          Don&rsquo;t have an account? <TextLink href="#">Sign up</TextLink>
        </>
      }
    >
      <SocialButtons />
      <AuthForm signup={false} />
    </AuthShell>
  );
}

export function SignupScreen() {
  return (
    <AuthShell
      contained
      title="Create your account"
      footer={
        <>
          Already have an account? <TextLink href="#">Log in</TextLink>
        </>
      }
    >
      <SocialButtons verb="Sign up" />
      <AuthForm signup />
    </AuthShell>
  );
}

const TABS: { id: string; label: string; icon: ZebriIcon }[] = [
  { id: 'business', label: 'Business', icon: BuildingIcon },
  { id: 'email', label: 'Email', icon: EmailIcon },
  { id: 'enquiries', label: 'Enquiries', icon: EnquiriesIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'booking-links', label: 'Booking links', icon: CalendarClockIcon },
  { id: 'bdm', label: 'Lodge with BDM', icon: BdmIcon },
];

function Business() {
  return (
    <div className="max-w-xl space-y-8">
      <Group title="Your business" why="Heads and signs off every document and email you send.">
        <F label="Business name" value="Arjun Punekar MC" className="sm:col-span-2" />
        <F label="Your name" value="Arjun Punekar" />
        <F label="What you do" value="MC" />
      </Group>
      <Group title="How couples reach you" why="On your documents and in your email signature.">
        <F label="Phone" type="tel" value="0400 123 456" />
        <F label="Email" type="email" value="hello@arjunmc.com.au" help="Where couples reply" />
        <F label="Website" type="url" placeholder="arjunmc.com.au" className="sm:col-span-2" />
      </Group>
      <Group title="Tax">
        <F label="ABN" value="51 824 753 556" help="On invoices and contracts" />
      </Group>
    </div>
  );
}

function Celebrant() {
  return (
    <div className="max-w-xl space-y-8">
      <Group title="Registration" why="As the Attorney-General's register has you.">
        <F label="Celebrant code" kind="select" value="A" />
        <F label="Registration number" value="A12345" />
        <F label="Celebrant type" kind="select" value="Commonwealth-registered" />
        <F label="Date of appointment" value="14 Mar 2019" />
      </Group>
      <Group title="Your name">
        <F label="Title" kind="select" value="Mr" />
        <F label="Family name" value="Punekar" />
        <F label="First given name" value="Arjun" />
        <F label="Other given names" />
        <F label="Date of birth" placeholder="1 Jul 1990" />
      </Group>
      <Group title="Address">
        <F label="Street address" className="sm:col-span-2" />
        <F label="Suburb or town" />
        <F label="State" kind="select" value="VIC" />
        <F label="Postcode" />
      </Group>
      <Group title="Registry">
        <F
          label="Email for Registry notices"
          type="email"
          value="hello@arjunmc.com.au"
          className="sm:col-span-2"
        />
        <F label="eRegistry username" />
      </Group>
    </div>
  );
}

export function SettingsScreen() {
  const [tab, setTab] = useState('business');
  return (
    <DialogCard size="split">
      <DialogHeader
        id="screen-settings"
        icon={SettingsIcon}
        title="Settings"
        size="split"
        closable={false}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Settings"
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-hairline p-4 md:w-56 md:flex-col md:border-b-0 md:border-r md:pl-7"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const on = id === tab;
            return (
              <button
                key={id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => setTab(id === 'bdm' ? 'bdm' : 'business')}
                className={`flex h-9 shrink-0 items-center gap-3 whitespace-nowrap rounded-button px-3 transition-colors duration-150 ${on ? 'bg-pressed type-label text-zebra-950' : 'type-body text-zebra-600 hover:bg-hover'}`}
              >
                <Icon
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${on ? 'text-zebra-950' : 'text-zebra-400'}`}
                />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === 'bdm' ? <Celebrant /> : <Business />}
        </div>
      </div>
    </DialogCard>
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

/** New client's optional details: chips in the boxed and floating directions, rows in the ledger and inset ones. */
function Details() {
  const d = use(DirectionContext);
  if (d === 'ledger' || d === 'inset') {
    return (
      <Group title="Details">
        <F label="Journey" kind="select" value="Wedding journey" />
        <F label="Event date" kind="select" value="Sat 10 Oct 2026 · in 15 days" />
        <F label="Venue" placeholder="Add a venue" />
        <F label="Guests" placeholder="Add" />
        <F label="Package" kind="select" placeholder="Choose" />
        <F label="Found you via" kind="select" placeholder="Choose" />
      </Group>
    );
  }
  return (
    <div className="space-y-2">
      <p className="type-label text-zebra-900">Details</p>
      <div className="-mx-2.5 flex flex-wrap gap-1">
        {chip(JourneysIcon, 'Journey', 'Wedding journey')}
        {chip(CalendarIcon, 'Event date', 'Sat 10 Oct 2026 · in 15 days')}
        {chip(VenueIcon, 'Venue', 'Hawthorn Hall')}
        {chip(GuestsIcon, 'Guests')}
        {chip(PackageIcon, 'Package')}
        {chip(SourceIcon, 'Found you via')}
      </div>
    </div>
  );
}

const BLANK =
  'border-b-2 border-dashed border-zebra-200 hover:border-zebra-400 focus-within:border-grass-500';

/** A blank to type into, inside the sentence. */
function Blank({
  label,
  value = '',
  wide = false,
}: {
  label: string;
  value?: string;
  wide?: boolean;
}) {
  const [v, setV] = useState(use(EmptyContext) ? '' : value);
  return (
    <FitInput
      aria-label={label}
      placeholder={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      plain
      className={`${BLANK} transition-colors duration-150${wide ? ' min-w-40' : ''}`}
      textClassName="type-title text-zebra-950 placeholder:text-zebra-300"
    />
  );
}

/** A blank that opens a picker. */
function Pick({ label, value: filled }: { label: string; value?: string }) {
  const value = use(EmptyContext) ? undefined : filled;
  return (
    <button
      type="button"
      className={`inline-flex items-baseline gap-1 transition-colors duration-150 ${BLANK} ${value ? 'text-zebra-950' : 'text-zebra-300'}`}
    >
      {value ?? label}
      <ChevronDownIcon aria-hidden="true" className="size-4 self-center text-zebra-400" />
    </button>
  );
}

/** Conversational: New client written as one sentence with blanks. */
function Conversation() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <p className="max-w-3xl type-title leading-[1.9] text-zebra-500">
        <Blank label="Their names" value="Amelia & Jack" /> are getting married on{' '}
        <Pick label="a date" value="Sat 10 Oct 2026" /> at{' '}
        <Pick label="a venue" value="Hawthorn Hall" />, with <Blank label="how many" /> guests.
        Reach them at <Blank label="email" wide /> or <Blank label="phone" />. They found you via{' '}
        <Pick label="somewhere" /> and start on the <Pick label="a journey" value="Wedding" />{' '}
        journey.
      </p>
      <textarea
        aria-label="Notes"
        rows={5}
        placeholder="Anything to remember…"
        className="w-full resize-none bg-transparent type-lead text-zebra-950 outline-none placeholder:text-zebra-300"
      />
    </div>
  );
}

export function NewClientScreen({ conversational = false }: { conversational?: boolean }) {
  const d = use(DirectionContext);
  const empty = use(EmptyContext);
  const rows = d === 'ledger' || d === 'inset';
  return (
    <DialogCard size="lg">
      <DialogHeader
        id="screen-new-client"
        title="New client"
        icon={ClientsIcon}
        size="lg"
        closable={false}
      />
      <DialogBody size="lg" className="flex flex-1 flex-col gap-8 overflow-y-auto">
        {conversational ? (
          <Conversation key={String(empty)} />
        ) : (
          <>
            <Group>
              <F label="Names" value="Amelia & Jack" className="sm:col-span-2" />
              <F label="Email" type="email" placeholder="amelia@example.com" />
              <F label="Phone" type="tel" placeholder="0400 000 000" />
            </Group>
            <Details />
            {rows ? (
              <Group title="Notes">
                <F
                  label="Notes"
                  kind="textarea"
                  rows={3}
                  placeholder="What they're after, how you met"
                />
              </Group>
            ) : (
              <F
                label="Notes"
                kind="textarea"
                rows={5}
                placeholder="What they're after, how you met, anything to remember"
              />
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter size="lg">
        <Button>Add client</Button>
      </DialogFooter>
    </DialogCard>
  );
}
