import type { ReactNode } from 'react';

/**
 * The container the marketing page's story shots play in (Journeys,
 * BDM lodgement), shaped like a record in Zebri: a head saying whose it
 * is, a quiet `zebra-50` canvas where the scenes change, and a foot with
 * one line on what just happened and when, so the visitor reads the
 * outcome as well as sees it (founder, 2026-10-18: "really push yourself"). The
 * caller sizes it and stacks its scenes on the canvas with
 * {@link sceneClass}.
 *
 * @example
 * ```tsx
 * <RecordFrame head={<p>Mia &amp; Leo</p>} events={EVENTS} shown={step} className="h-[34rem]">
 *   {SCENES.map((Scene, i) => <div key={i} className={sceneClass(i, step)}><Scene /></div>)}
 * </RecordFrame>
 * ```
 *
 * @module app/design-system/v2/pages/website/record-frame
 */

/**
 * A scene's place in the hand-off, which runs in turn: the last clears in
 * 200ms, then the new one rises in, so two never show through each other
 * mid-change (they did when both moved at once). Absolute, filling the canvas.
 */
export function sceneClass(i: number, shown: number): string {
  const base = 'absolute inset-0 transition ease-out motion-reduce:transition-none';
  if (i === shown) return `${base} z-10 translate-y-0 scale-100 opacity-100 duration-500 delay-200`;
  return `${base} duration-200 opacity-0 ${i < shown ? 'scale-[0.98]' : 'translate-y-6'}`;
}

/** One beat's foot line: what happened, and when (a date makes a story of months believable). */
export interface RecordEvent {
  text: string;
  when: string;
}

interface RecordFrameProps {
  /** Whose record it is, and where it stands. */
  head: ReactNode;
  /** The foot's line for each beat, by index: what happened, and when. */
  events: RecordEvent[];
  /** The beat the foot says; none before the story starts. */
  shown: number;
  /** Sizes it. */
  className?: string;
  /** The scenes, stacked with {@link sceneClass}. */
  children: ReactNode;
}

/** The record. See {@link RecordFrameProps}. */
export function RecordFrame({ head, events, shown, className = '', children }: RecordFrameProps) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-panel bg-field shadow-xl ring-1 ring-zebra-950/10 ${className}`}>
      <div className="shrink-0 border-b border-hairline px-4 py-4 sm:px-6">{head}</div>
      {/* The canvas and the foot are a picture of the product: inert and hidden from screen
          readers. The head stays live, for a caller that puts a control in it. */}
      <div aria-hidden="true" inert className="relative min-h-0 flex-1 overflow-hidden bg-zebra-50">
        {children}
      </div>
      <div aria-hidden="true" inert className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)] items-center border-t border-hairline px-4 sm:px-6">
        {events.map(({ text, when }, i) => (
          <p
            key={text}
            className={`col-start-1 row-start-1 flex items-center gap-2.5 type-body text-zebra-600 transition ease-out motion-reduce:transition-none ${
              i === shown ? 'translate-y-0 opacity-100 duration-500 delay-200' : 'translate-y-1 opacity-0 duration-200'
            }`}
          >
            <span className="size-2 shrink-0 rounded-pill bg-grass-500 ring-4 ring-grass-100" />
            <span className="min-w-0 flex-1 truncate">{text}</span>
            <span className="shrink-0 text-zebra-400">{when}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
