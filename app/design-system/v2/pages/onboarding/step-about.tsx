'use client';

import { useId, useRef, useState } from 'react';

import { ChipGroup } from '@/components/ui-v2/chip-group';
import { BriefcaseIcon, GlobeIcon, UserIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { BrandFinder, FOUND_BRAND, type FinderStatus } from './brand-finder';
import type { Brand, Profile } from './use-onboarding-state';

/**
 * Step 1, About you. Asks as little as it can, and only the name is
 * required: in the live flow the name arrives from Google sign-in,
 * what you do is guessed from the business name, and a website offers
 * its brand, offered right under it.
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

/** The roles an MC-adjacent business is. Several can apply. */
const ROLES = ['MC', 'Celebrant', 'DJ'];

const domainOf = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

export interface StepAboutProps {
  profile: Profile;
  onProfile: (patch: Partial<Profile>) => void;
  onBrand: (patch: Partial<Brand>) => void;
  nameError?: string | undefined;
  /** Inside a showroom preview the page has its own h1, so the title steps down to h2. */
  contained?: boolean | undefined;
}

export function StepAbout({ profile, onProfile, onBrand, nameError, contained = false }: StepAboutProps) {
  const Title = contained ? 'h2' : 'h1';
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

  // Option G (user ruling, 2026-10-14): each field is a line led by its
  // icon, the words themselves the field (its name in grey until typed),
  // all one size; hovering tints just the words.
  return (
    <div className="space-y-10">
      {/* The one title role for the entry screens (log in, sign up and this step). */}
      <Title className="type-title text-zebra-950 md:type-display">Tell us about you</Title>
      <div className="space-y-6">
        <div className="space-y-1">
          <Input
            id={`${groupId}-name`}
            icon={UserIcon}
            label="Your name"
            error={nameError}
            autoComplete="name"
            value={profile.name}
            onChange={(e) => onProfile({ name: e.target.value })}
            data-autofocus
          />
          <Input
            id={`${groupId}-business`}
            icon={BriefcaseIcon}
            label="Business or stage name"
            autoComplete="organization"
            value={profile.business}
            onChange={(e) => {
              const business = e.target.value;
              onProfile(rolesTouched ? { business } : { business, roles: rolesFromName(business) });
            }}
          />
          <Input
            id={`${groupId}-website`}
            icon={GlobeIcon}
            label="Website"
            type="url"
            maxLength={200}
            autoComplete="url"
            value={profile.website}
            onChange={(e) => onProfile({ website: e.target.value })}
            onBlur={lookUp}
          />
        </div>
        <BrandFinder
          status={finder}
          domain={domainOf(profile.website)}
          onUse={() => (onBrand(FOUND_BRAND), setFinder('used'))}
          onDismiss={() => setFinder('dismissed')}
        />
      </div>
      {/* Bordered chips, so each reads as something to tap (soft chips were faint words here, with no fields around them to sit among). Several can be true at once (an MC who also celebrates), so there is no "Other". */}
      <div className="space-y-2">
        <ChipGroup
          multiple
          label="What you do"
          options={ROLES}
          value={profile.roles}
          onChange={(roles) => {
            setRolesTouched(true);
            onProfile({ roles });
          }}
        />
        {guessed ? (
          <p className="type-body text-zebra-500">
            Picked from your business name. Change it if we got it wrong.
          </p>
        ) : null}
      </div>
    </div>
  );
}
