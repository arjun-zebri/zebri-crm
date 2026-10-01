'use client';

import { Home, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { NavItem } from '../demo-data';

import { CATALOG, DEFAULT_ADDED, type Block, type Tier } from './catalog';

/**
 * Blocks state for the v2 dashboard: what is added, the plan, and what
 * is mid-connect. Lifted to the dashboard page so the sidebar and the
 * Blocks dialog read the same set. Demo only: nothing is saved, and
 * Connect and Upgrade wait a beat instead of running OAuth or Stripe.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/use-blocks
 */

/** Always in the sidebar, whatever is added. */
const CORE: NavItem[] = [
  { label: 'Home', icon: Home },
  { label: 'Clients', icon: Users },
];

/** Long enough to see the spinner, short enough not to feel slow. */
const BUSY_MS = 1100;

/**
 * The gap between each block of an "Add all": long enough that each
 * row's tick and sidebar entry land one after another, short enough
 * that three are in within about half a second.
 */
const STAGGER_MS = 240;

/**
 * The sidebar's rows: the core pair, then added tools in catalogue order,
 * less any the MC has switched out of the sidebar.
 */
export function sidebarItems(added: ReadonlySet<string>, hidden: ReadonlySet<string>): NavItem[] {
  const tools = CATALOG.flatMap((b) =>
    b.kind === 'tool' && added.has(b.id) && !hidden.has(b.id) ? [{ label: b.name, icon: b.icon }] : [],
  );
  return [...CORE, ...tools];
}

/** What the Blocks dialog holds and does. See {@link useBlocks}. */
export interface BlocksState {
  added: ReadonlySet<string>;
  /** Added tools kept out of the sidebar ("Show in sidebar" off). */
  hidden: ReadonlySet<string>;
  plan: Tier;
  /**
   * The block mid-connect, `'upgrade'` while the plan changes, or
   * `'bundle'` while an Add all is still landing its blocks.
   */
  busy: string | null;
  /** Needs a plan the MC is not on. */
  locked: (block: Block) => boolean;
  /** Tools add at once; integrations wait a beat, as a connect would. */
  add: (block: Block) => void;
  /**
   * Adds several tools one after another (a featured bundle). `pace`
   * slows it for a moment meant to be watched: a gap before the first
   * and between each, instead of the first landing at once.
   */
  addAll: (blocks: Block[], pace?: { lead: number; gap: number }) => void;
  remove: (block: Block) => void;
  /** Shows or hides an added tool in the sidebar without removing it. */
  setShown: (block: Block, shown: boolean) => void;
  upgrade: () => void;
}

/** Where {@link useBlocks} starts, and who hears about changes. */
export interface UseBlocksOptions {
  /** Added on first render; {@link DEFAULT_ADDED} when left out. */
  initial?: readonly string[] | undefined;
  /**
   * The plan to start on. Onboarding starts on Max, so nothing reads as
   * locked before the MC has chosen a plan (the next step).
   */
  plan?: Tier | undefined;
  /** Called with the added ids after every change (onboarding saves them). */
  onChange?: ((ids: string[]) => void) | undefined;
}

/** Blocks state. Starts on Pro with {@link DEFAULT_ADDED} unless told otherwise. */
export function useBlocks({ initial, plan: startPlan = 'pro', onChange }: UseBlocksOptions = {}): BlocksState {
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set(initial ?? DEFAULT_ADDED));
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [plan, setPlan] = useState<Tier>(startPlan);
  // Read through a ref, so a caller passing a fresh function each render
  // does not re-fire the effect. Kept current by an effect declared first,
  // so it is up to date before the one below reads it.
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    changed.current?.([...added]);
  }, [added]);
  const [busy, setBusy] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void) => {
    timers.current.push(window.setTimeout(() => { fn(); setBusy(null); }, BUSY_MS));
  };
  const toggle = (set: typeof setAdded, ids: string[], on: boolean) =>
    set((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const put = (ids: string[], on: boolean) => toggle(setAdded, ids, on);

  return {
    added,
    hidden,
    plan,
    busy,
    locked: (block) => block.tier === 'max' && plan === 'pro',
    add(block) {
      if (block.kind === 'tool') return put([block.id], true);
      setBusy(block.id);
      later(() => put([block.id], true));
    },
    // One at a time rather than in one set: all at once, every row and
    // sidebar entry changed in the same frame and the motion read as a jump.
    addAll(blocks, pace = { lead: 0, gap: STAGGER_MS }) {
      if (blocks.length === 0) return;
      setBusy('bundle');
      blocks.forEach((b, i) => {
        timers.current.push(
          window.setTimeout(() => {
            put([b.id], true);
            if (i === blocks.length - 1) setBusy(null);
          }, pace.lead + i * pace.gap),
        );
      });
    },
    // Removing forgets the sidebar choice, so re-adding shows it again.
    remove(block) {
      put([block.id], false);
      toggle(setHidden, [block.id], false);
    },
    setShown: (block, shown) => toggle(setHidden, [block.id], !shown),
    upgrade() {
      setBusy('upgrade');
      later(() => setPlan('max'));
    },
  };
}
