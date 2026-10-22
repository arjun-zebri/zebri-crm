/**
 * Design system v2 timeline (preview): the steps something goes through,
 * top to bottom, a dot each on one hairline thread. Done is a grass dot,
 * the one it is on now a grass ring, anything later a grey ring with its
 * words in grey, so what has happened and what is to come read apart at
 * a glance. Each step has its words and, quieter on the right, when
 * ("15 Oct", "by Fri 6 Feb"). For a record's own history in a side
 * column (a couple's paperwork; user, 2026-10-15), not for a feed of
 * activity, which is rows.
 *
 * @example
 * ```tsx
 * <Timeline
 *   label="History"
 *   steps={[
 *     { label: 'Sent to the couple', when: '28 Sep', state: 'done' },
 *     { label: 'Answers back', state: 'now' },
 *     { label: 'Wedding', when: 'Sat 31 Oct', state: 'later' },
 *   ]}
 * />
 * ```
 *
 * @module components/ui-v2/timeline
 */

export interface TimelineStep {
  label: string;
  /** When it happened, or is due. */
  when?: string | undefined;
  state: 'done' | 'now' | 'later';
}

export interface TimelineProps {
  /** What the list is, for screen readers. */
  label: string;
  steps: TimelineStep[];
}

const DOT: Record<TimelineStep['state'], string> = {
  done: 'bg-grass-500',
  now: 'bg-field ring-2 ring-inset ring-grass-500',
  later: 'bg-field ring-1 ring-inset ring-zebra-300',
};

/** v2 timeline. See {@link TimelineProps}. */
export function Timeline({ label, steps }: TimelineProps) {
  return (
    <ol aria-label={label} className="type-body">
      {steps.map((s, i) => (
        <li key={`${s.label}-${i}`} aria-current={s.state === 'now' ? 'step' : undefined} className="relative flex gap-3 pb-4 last:pb-0">
          {/* The thread to the next dot, under this one. */}
          {i < steps.length - 1 ? <span aria-hidden="true" className="absolute top-3 bottom-0 left-[4.5px] w-px bg-zebra-200" /> : null}
          <span aria-hidden="true" className={`relative mt-1.5 size-2.5 shrink-0 rounded-pill ${DOT[s.state]}`} />
          <span className={`min-w-0 flex-1 ${s.state === 'later' ? 'text-zebra-500' : 'text-zebra-950'}`}>
            {s.label}
            {s.state === 'done' ? <span className="sr-only"> (done)</span> : null}
          </span>
          {s.when ? <span className="shrink-0 tabular-nums text-zebra-500">{s.when}</span> : null}
        </li>
      ))}
    </ol>
  );
}
