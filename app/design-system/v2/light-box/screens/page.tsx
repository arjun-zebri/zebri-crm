'use client';

import { useState } from 'react';

import { Segmented } from '@/components/ui-v2/segmented';

import { DirectionContext, EmptyContext, Stage, type Direction } from './field-kit';
import { LoginScreen, NewClientScreen, SettingsScreen, SignupScreen } from './screens';

/**
 * Full-size screens, one switcher for the field direction (user,
 * 2026-10-15: "how can we really push the creativity here - the boxed
 * inputs are so old school"). Each direction is drawn on the same real
 * screens at real size. Mocks only.
 *
 * @module app/design-system/v2/light-box/screens/page
 */

type Option = 'Ledger rows' | 'Inset list' | 'Floating wells' | 'Conversational' | 'Boxed (before)';
const OPTIONS: readonly Option[] = [
  'Ledger rows',
  'Inset list',
  'Floating wells',
  'Conversational',
  'Boxed (before)',
];

const DIRECTION: Record<Option, Direction> = {
  'Ledger rows': 'ledger',
  'Inset list': 'inset',
  'Floating wells': 'float',
  // New client becomes a sentence; forms that can't be a sentence use ledger rows.
  Conversational: 'ledger',
  'Boxed (before)': 'boxed',
};

const ABOUT: Record<Option, string> = {
  'Ledger rows':
    'Like Attio and Notion. Every field is a row: its name on the left in grey, the value on the right as plain text, no lines between: just space, with the row lighting up softly on hover. The whole row lights up on hover and is the target. No boxes anywhere, and forms look exactly like a client’s Overview, so the app has one style for every value.',
  'Inset list':
    'Like Apple’s Settings. Fields are rows inside a soft grouped panel: the name on the left, the value right-aligned in grey. Calm and very tidy; reads as settings rather than paperwork.',
  'Floating wells':
    'Like Apple ID and Stripe Checkout. A tall soft well with no border; the name sits small inside it, the value under it. Turns white with a crisp edge when you click in.',
  Conversational:
    'New client is written as a sentence with blanks to fill (“Amelia & Jack are getting married on…”). Feels like telling Zebri about them, not filling a form. Works for short create flows (New client, onboarding); longer forms (Settings) fall back to ledger rows.',
  'Boxed (before)': 'The hairline boxes you rejected, for comparison.',
};

export default function ScreensPage() {
  const [opt, setOpt] = useState<Option>('Ledger rows');
  const [state, setState] = useState<'Empty' | 'Filled'>('Empty');
  return (
    <DirectionContext value={DIRECTION[opt]}>
      <EmptyContext value={state === 'Empty'}>
        <main className="min-h-screen bg-zebra-50 px-4 py-10 md:px-10">
          <div className="mx-auto max-w-6xl space-y-14">
            <header className="sticky top-0 z-10 -mx-4 space-y-3 bg-zebra-50/90 px-4 py-4 backdrop-blur md:-mx-10 md:px-10">
              <h1 className="type-title text-zebra-950">Fields, full size: four directions</h1>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented label="Direction" options={OPTIONS} value={opt} onChange={setOpt} />
                <Segmented
                  label="State"
                  options={['Empty', 'Filled'] as const}
                  value={state}
                  onChange={setState}
                />
              </div>
              <p className="max-w-3xl type-body text-zebra-600">{ABOUT[opt]}</p>
            </header>
            <Stage title="New client" dim note="The lg dialog at its real size (56rem by 46rem).">
              <NewClientScreen conversational={opt === 'Conversational'} />
            </Stage>
            <Stage
              dim
              title="Settings"
              note="The Settings dialog at its real size (56rem by 37rem). Pick Lodge with BDM in the rail for the longest form in the app."
            >
              <SettingsScreen />
            </Stage>
            <Stage
              title="Log in and sign up"
              note="Always boxed, whatever the direction: the first screens anyone sees, where a box needs no explaining and password managers expect one."
            >
              <div className="grid w-full gap-6 lg:grid-cols-2">
                <LoginScreen />
                <SignupScreen />
              </div>
            </Stage>
          </div>
        </main>
      </EmptyContext>
    </DirectionContext>
  );
}
