'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';

import { CONNECTIONS, type Connection } from './connections';

/**
 * The "Your apps" half of step 2, Build your Zebri: a running "N connected" count, then one row per
 * group, its name and reason on the left and its providers in a list on
 * the right, each with its real mark and one action slot.
 *
 * The slot is a fixed 128 by 32 and every state fills it (Connect, the
 * Connecting spinner, Connected, Coming soon), so a row never shifts as it
 * changes. Connecting to connected is the moment to reward: the badge
 * springs in, its tick draws itself, a check pops onto the mark and the
 * row warms to a faint green. All of it is skipped under reduced motion.
 * Demo: Connect waits a beat and flips the row; no OAuth runs.
 *
 * @module app/design-system/v2/pages/onboarding/step-connect
 */

type RowState = 'idle' | 'connecting' | 'connected';

// How long the demo "OAuth round trip" takes: long enough to see the
// spinner, short enough not to feel slow.
const CONNECT_MS = 1100;

/**
 * The connections list. `onCount` hands the running "N connected" count
 * to the caller (Build your Zebri shows it on its tab) instead of the
 * list drawing its own line.
 */
export function StepConnect({ onCount }: { onCount?: (n: number) => void } = {}) {
  const [states, setStates] = useState<Record<string, RowState>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const set = (name: string, state: RowState) => setStates((s) => ({ ...s, [name]: state }));
  function connect(name: string) {
    set(name, 'connecting');
    timers.current.push(window.setTimeout(() => set(name, 'connected'), CONNECT_MS));
  }
  const count = Object.values(states).filter((s) => s === 'connected').length;
  // Through a ref, so a caller's fresh function each render is not a change.
  const counted = useRef(onCount);
  useEffect(() => {
    counted.current = onCount;
  });
  useEffect(() => counted.current?.(count), [count]);

  return (
    <div className="relative space-y-8">
      {/* Always rendered so the count can announce. From sm it floats up
          to the right end of the intro line (the intro ends 28px above
          this block), taking no room. On phones the intro wraps under it,
          so it keeps a line of its own, height held so nothing jumps. */}
      {onCount ? null : (
        <p
          role="status"
          className="-mt-3 flex h-5 items-center gap-2 type-body text-grass-800 sm:absolute sm:-top-12 sm:right-0 sm:mt-0"
        >
          {count > 0 ? (
            <span
              key={count}
              className="flex items-center gap-2 motion-safe:animate-[fade-in_300ms_ease-out_both]"
            >
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-grass-600" />
              {count} connected
            </span>
          ) : null}
        </p>
      )}
      {CONNECTIONS.map((group) => (
        <section
          key={group.title}
          aria-labelledby={`conn-${group.title}`}
          className="grid gap-3 sm:grid-cols-[11rem_1fr] sm:gap-8"
        >
          <div>
            <h3 id={`conn-${group.title}`} className="type-label text-zebra-950">
              {group.title}
            </h3>
            <p className="mt-1 type-body text-zebra-500">{group.why}</p>
          </div>
          <ul className="divide-y divide-zebra-200 overflow-hidden rounded-panel border border-zebra-200 bg-field">
            {group.rows.map((row) => (
              <Row
                key={row.name}
                row={row}
                state={states[row.name] ?? 'idle'}
                onConnect={() => connect(row.name)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// A soft spring (a touch of overshoot, then settle), written out in full
// so Tailwind sees the class.
const POP = 'motion-safe:animate-[chip-expand_450ms_cubic-bezier(0.34,1.56,0.64,1)_both]';

function Row({
  row,
  state,
  onConnect,
}: {
  row: Connection;
  state: RowState;
  onConnect: () => void;
}) {
  const Icon = row.icon;
  const soon = row.kind === 'soon';
  const on = state === 'connected';
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 transition-colors duration-700 ease-out motion-reduce:transition-none ${on ? 'bg-grass-50/60' : ''}`}
    >
      {/* Faded, not hidden: what is coming is part of the pitch. */}
      <span
        className={`relative flex size-9 shrink-0 items-center justify-center rounded-button border border-zebra-200 bg-field ${soon ? 'opacity-50' : ''}`}
      >
        {/* Brand colours are the brands' own, so they are the icon's
            `color` prop rather than mapped to our tokens. */}
        <Icon
          aria-hidden
          {...(row.color ? { color: row.color } : {})}
          className={`size-5 ${row.color ? '' : 'text-zebra-600'}`}
        />
        {on ? (
          <span
            aria-hidden="true"
            className={`absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-pill bg-grass-700 text-zebra-50 ring-2 ring-field ${POP} motion-safe:[animation-delay:120ms]`}
          >
            <DrawnCheck className="size-2.5" />
          </span>
        ) : null}
      </span>
      <span
        className={`min-w-0 flex-1 truncate type-label text-zebra-950 ${soon ? 'opacity-50' : ''}`}
      >
        {row.name}
      </span>
      <span className="flex w-32 shrink-0 justify-end">
        {soon ? (
          <Badge size="control" className="w-full">
            Coming soon
          </Badge>
        ) : on ? (
          <Badge size="control" tone="brand" className={`w-full ${POP}`}>
            <DrawnCheck className="size-3.5" />
            Connected
          </Badge>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            loading={state === 'connecting'}
            onClick={row.kind === 'connect' ? onConnect : undefined}
          >
            {state === 'connecting' ? 'Connecting' : row.kind === 'connect' ? 'Connect' : 'Set up'}
          </Button>
        )}
      </span>
    </li>
  );
}

/** A check whose stroke draws itself (the `tick-draw` keyframe, dash 24). */
function DrawnCheck({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        strokeDasharray={24}
        className="motion-safe:animate-[tick-draw_400ms_cubic-bezier(0.65,0,0.35,1)_200ms_both]"
      />
    </svg>
  );
}
