'use client';

import { useSyncExternalStore } from 'react';

import { useAccount } from '../account';
import { kept, type Kept } from '../doc-builder/state/kept';

import { JOURNEYS, type Journey, type JourneyStep } from './journeys-data';
import type { OnJourney } from './journeys-people';

/**
 * The MC's journeys and every change to them: a step's settings, the
 * order, adding and removing steps, the journeys themselves (new,
 * rename, duplicate, delete, tab order, which one new enquiries start
 * on), and the clients on them (add, move, take off). The preview has no
 * server, so changes are kept in this browser per account (`kept`) and a
 * reload keeps them; until the first change the demo journeys show.
 *
 * Changes reach clients already on a journey at their next step;
 * anything already sent stays as it went. Removing a step moves the
 * clients waiting on it to the step after.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/use-journeys
 */

// v3 of the key: v2 predates the step settings and the reworded demo steps (2026-10-07).
const STORE = kept<Journey[]>('zebri-v2-journeys-3');

/**
 * Where a set of journeys is kept, for a page other than the main
 * dashboard's (the first run keeps a new account's own). `seed` shows
 * until the first change and must be the same array between renders
 * (memoise it), or the store reads as changed every time.
 */
export interface JourneysSource {
  store: Kept<Journey[]>;
  owner: string;
  seed: Journey[];
}

/** The journeys and what changes them; the main dashboard's demo ones unless `source` says otherwise. */
export function useJourneys(source?: JourneysSource) {
  const business = useAccount().business;
  const store = source?.store ?? STORE;
  const owner = source?.owner ?? business;
  const seed = source?.seed ?? JOURNEYS;
  const journeys = useSyncExternalStore(store.subscribe, () => store.read(owner) ?? seed, () => seed);
  const save = (next: Journey[]) => store.write(owner, next);
  const change = (id: string, fn: (j: Journey) => Journey) => save(journeys.map((j) => (j.id === id ? fn(j) : j)));
  const move = (id: string, by: number) => {
    const at = journeys.findIndex((j) => j.id === id);
    const to = at + by;
    if (at === -1 || to < 0 || to >= journeys.length) return;
    const next = [...journeys];
    [next[at], next[to]] = [next[to]!, next[at]!];
    save(next);
  };
  return {
    journeys,
    /** Replaces one step. */
    updateStep: (journey: string, step: JourneyStep) => change(journey, (j) => ({ ...j, steps: j.steps.map((s) => (s.id === step.id ? step : s)) })),
    /** Sets the steps' order, by id. */
    reorder: (journey: string, ids: string[]) =>
      change(journey, (j) => ({ ...j, steps: ids.map((id) => j.steps.find((s) => s.id === id)).filter((s): s is JourneyStep => Boolean(s)) })),
    /** Removes a step; whoever was waiting on it moves to the step after (or before, for the last). */
    removeStep: (journey: string, step: string) =>
      change(journey, (j) => {
        const at = j.steps.findIndex((s) => s.id === step);
        const next = j.steps[at + 1] ?? j.steps[at - 1];
        return { ...j, steps: j.steps.filter((s) => s.id !== step), people: j.people.map((p) => (p.step === step && next ? { ...p, step: next.id } : p)) };
      }),
    /** Puts a journey back as it was: the undo for removing a step. */
    restore: (journey: Journey) => change(journey.id, () => journey),
    /** Adds a step at `at`, or just before the day marker (most steps lead up to it). */
    addStep: (journey: string, step: JourneyStep, at?: number) =>
      change(journey, (j) => {
        const day = j.steps.findIndex((s) => s.kind === 'day');
        const i = at ?? (day === -1 ? j.steps.length : day);
        return { ...j, steps: [...j.steps.slice(0, i), step, ...j.steps.slice(i)] };
      }),
    /** A new journey copying `from`'s steps, with no clients yet; returns its id. */
    create: (name: string, from: string) => {
      const base = journeys.find((j) => j.id === from) ?? journeys[0]!;
      const id = `journey-${Date.now()}`;
      save([...journeys, { id, name, steps: base.steps.map((s) => ({ ...s })), people: [] }]);
      return id;
    },
    rename: (journey: string, name: string) => change(journey, (j) => ({ ...j, name })),
    /** Deletes a journey; its clients come off it. New enquiries move to the first journey left if it was theirs. */
    remove: (journey: string) => {
      const left = journeys.filter((j) => j.id !== journey);
      const starts = left.some((j) => j.starts);
      save(left.map((j, i) => (!starts && i === 0 ? { ...j, starts: true } : j)));
    },
    /** Moves a journey's tab one place left (-1) or right (1). */
    move,
    /** New enquiries start on `journey`. */
    setStarts: (journey: string) => save(journeys.map((j) => ({ ...j, starts: j.id === journey }))),
    /** Puts a client on `journey` at `step`, taking them off any other journey first. */
    addPerson: (journey: string, person: Omit<OnJourney, 'days'>) =>
      save(journeys.map((j) => ({ ...j, people: [...j.people.filter((p) => p.id !== person.id), ...(j.id === journey ? [{ ...person, days: 0 }] : [])] }))),
    /** Renames a client wherever they are on a journey (their profile's contacts changed). */
    renamePerson: (id: string, name: string) =>
      save(journeys.map((j) => ({ ...j, people: j.people.map((p) => (p.id === id ? { ...p, name } : p)) }))),
    /** Takes a client off whichever journey they are on. */
    removePerson: (id: string) => save(journeys.map((j) => ({ ...j, people: j.people.filter((p) => p.id !== id) }))),
  };
}

/** What `useJourneys` returns. */
export type JourneysState = ReturnType<typeof useJourneys>;
