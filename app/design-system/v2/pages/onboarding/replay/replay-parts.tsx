import type { ReactNode } from 'react';

/**
 * The replay's shared pieces: the card each moment sits on, and the
 * anatomy every card shares with the brand step's proposal (a brand
 * eyebrow, a title in the MC's heading font, a status strip at the
 * foot), plus the reveal that brings each detail in on its beat.
 *
 * Colours and fonts come from the brand custom properties that
 * `brandVars` sets on the stage.
 *
 * @module app/design-system/v2/pages/onboarding/replay/replay-parts
 */

/** The shared "did it happen yet" check for one card's four sub-beats. */
export type Beat = (k: number) => boolean;

/**
 * One moment's card, stacked with the rest on the stage. The current
 * card is in place; past ones have lifted away and upcoming ones wait
 * just below, both faded out. The outgoing card fades quickly and the
 * incoming one starts a beat later, so the two never sit half-faded on
 * top of each other with their text colliding.
 */
export function Card({
  at,
  step,
  children,
  tone = 'paper',
}: {
  at: number;
  step: number;
  children: ReactNode;
  /** `paper` is a white card with padding; `tight` has a thin edge (the call); `bleed` runs to the edges; `brand` is the booked card. */
  tone?: 'paper' | 'tight' | 'bleed' | 'brand';
}) {
  const current = at === step;
  const place = current
    ? 'opacity-100 [transition:opacity_500ms_200ms,translate_800ms_cubic-bezier(0.2,0.7,0.2,1),scale_800ms_cubic-bezier(0.2,0.7,0.2,1)]'
    : `opacity-0 scale-98 [transition:opacity_250ms,translate_800ms_cubic-bezier(0.2,0.7,0.2,1),scale_800ms_cubic-bezier(0.2,0.7,0.2,1)] ${at < step ? '-translate-y-3.5' : 'translate-y-4.5'}`;
  const look =
    tone === 'brand'
      ? 'bg-[image:var(--b-deep)] p-6 text-[var(--b-on-primary)] shadow-xl sm:p-9'
      : `bg-field shadow-lg ${tone === 'bleed' ? 'overflow-hidden' : tone === 'tight' ? 'p-3.5' : 'px-5 py-6 sm:px-8 sm:py-7'}`;
  return (
    <div
      inert={!current}
      aria-hidden={!current}
      className={`absolute inset-0 flex flex-col rounded-panel font-[family-name:var(--b-body)] motion-reduce:transition-none ${look} ${place}`}
    >
      {children}
    </div>
  );
}

/** Fades a detail in and up by 6px once its beat arrives. */
export function Reveal({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`transition-[opacity,translate] duration-500 motion-reduce:transition-none ${on ? 'opacity-100' : 'translate-y-1.5 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The small brand-coloured label at the top of a card. No time beside
 * it: the story column already says when, and saying it twice clutters.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="type-eyebrow text-[var(--b-primary)]">{children}</p>;
}

/** A card's title, in the MC's heading font. */
export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`type-title text-zebra-950 font-[family-name:var(--b-heading)] ${className}`}>{children}</p>;
}

/** The status line at the foot of a card, under a hairline. */
export function Strip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mt-auto border-t border-zebra-100 pt-4 ${className}`}>{children}</div>;
}

/** A small brand dot, the replay's "this happened" mark. */
export function Dot() {
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-[var(--b-primary)]" />;
}

/** A label and value row, as in a CRM record or an agreement. */
export function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 type-body ${last ? '' : 'border-b border-zebra-100'}`}>
      <span className="text-zebra-500">{label}</span>
      {children}
    </div>
  );
}
