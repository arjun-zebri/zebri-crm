'use client';

import { Globe } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Input } from '@/components/ui-v2/input';

import { BrandFinder, FOUND_BRAND, type FinderStatus } from './brand-finder';
import type { Brand, Profile } from './use-onboarding-state';

/**
 * Step 1, About you. Asks as little as it can, and only the name is
 * required: in the live flow the name arrives from Google sign-in,
 * what you do is guessed from the business name, and a website offers
 * its brand for step 3.
 *
 * @module app/design-system/v2/pages/onboarding/step-about
 */

/** The roles a business name implies, e.g. "Jane Doe Celebrant" → Celebrant. */
export function rolesFromName(business: string): string[] {
  const roles: string[] = [];
  if (/\bmc\b|master of ceremon|emcee/i.test(business)) roles.push('MC');
  if (/celebrant/i.test(business)) roles.push('Celebrant');
  if (/\bdj\b|disc jockey/i.test(business)) roles.push('DJ');
  return roles;
}

/**
 * The roles, each with a line in the MC's own voice: what the job feels
 * like on the day, not a category label.
 */
const ROLES = [
  { name: 'MC', line: 'I run the room' },
  { name: 'Celebrant', line: 'I lead the ceremony' },
  { name: 'DJ', line: 'I fill the floor' },
  { name: 'Other', line: 'Something else' },
];

const domainOf = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

export interface StepAboutProps {
  profile: Profile;
  onProfile: (patch: Partial<Profile>) => void;
  onBrand: (patch: Partial<Brand>) => void;
  nameError?: string | undefined;
}

export function StepAbout({ profile, onProfile, onBrand, nameError }: StepAboutProps) {
  // Once the MC picks roles themselves, stop guessing over them.
  const [rolesTouched, setRolesTouched] = useState(profile.roles.length > 0);
  const [finder, setFinder] = useState<FinderStatus>('idle');
  const looked = useRef('');
  const groupId = useId();
  const guessed = !rolesTouched && profile.roles.length > 0;

  function lookUp() {
    const domain = domainOf(profile.website.trim());
    if (!/\.[a-z]{2,}$/i.test(domain) || looked.current === domain) return;
    looked.current = domain;
    setFinder('looking');
    setTimeout(() => setFinder('found'), 900);
  }

  const toggle = (role: string) => {
    setRolesTouched(true);
    onProfile({ roles: profile.roles.includes(role) ? profile.roles.filter((r) => r !== role) : [...profile.roles, role] });
  };

  // Placeholders say what goes in, never a made-up answer: a grey
  // "Jane Doe Celebrant" reads as already filled in.
  return (
    <div className="space-y-7">
      <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
        <Input
          label="Your name"
          autoComplete="name"
          placeholder="Your full name"
          value={profile.name}
          onChange={(e) => onProfile({ name: e.target.value })}
          error={nameError}
        />
        <Input
          label="Business name"
          autoComplete="organization"
          optional
          placeholder="Your business or stage name"
          value={profile.business}
          onChange={(e) => {
            const business = e.target.value;
            onProfile(rolesTouched ? { business } : { business, roles: rolesFromName(business) });
          }}
        />
      </div>
      <div className="space-y-3">
        <Input
          label="Website"
          optional
          type="url"
          placeholder="yourwebsite.com.au"
          maxLength={200}
          leading={<Globe strokeWidth={1.5} className="size-4" />}
          value={profile.website}
          onChange={(e) => onProfile({ website: e.target.value })}
          onBlur={lookUp}
          help="We'll pull your logo, colours and fonts from it."
        />
        <BrandFinder
          status={finder}
          domain={domainOf(profile.website)}
          onUse={() => (onBrand(FOUND_BRAND), setFinder('used'))}
          onDismiss={() => setFinder('dismissed')}
        />
      </div>
      <div role="group" aria-labelledby={groupId} aria-describedby={`${groupId}-desc`} className="space-y-2">
        {/* Label then hint, the same as every field (see Field). */}
        <div className="space-y-0.5">
          <p id={groupId} className="type-label text-zebra-950">
            What you do
          </p>
          <p id={`${groupId}-desc`} className="type-body text-zebra-500">
            Select all that apply
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLES.map((r) => (
            <ChoiceCard key={r.name} check selected={profile.roles.includes(r.name)} onClick={() => toggle(r.name)} className="gap-4">
              <span>
                <span className="block type-label">{r.name}</span>
                <span className="block type-body text-zebra-500">{r.line}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
        {guessed ? <p className="type-body text-zebra-500">Picked from your business name. Change it if we got it wrong.</p> : null}
      </div>
    </div>
  );
}
