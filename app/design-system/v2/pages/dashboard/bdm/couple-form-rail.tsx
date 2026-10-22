'use client';

import { GroupLabel } from '@/components/ui-v2/group-label';
import { CircleCheckIcon, FileCheckIcon, StartIcon } from '@/components/ui-v2/icons';

import type { FormPart } from './couple-form-parts';

/**
 * The couple's form's outline, down the card's left from `lg` (user,
 * 2026-10-15): Before you start, then each person's parts under their
 * name, the two of them, and Check and send. A finished part is ticked;
 * the one on screen rests on the pressed fill, as Settings' rail does;
 * any can be opened. On phones the progress line along the bar's foot
 * takes its place.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-rail
 */

/** Where the form is: the welcome page, a part, or the check. */
export type FormScreen = { kind: 'welcome' } | { kind: 'part'; at: number } | { kind: 'review' };

export interface CoupleFormRailProps {
  parts: FormPart[];
  screen: FormScreen;
  onGo: (screen: FormScreen) => void;
}

/** One row of the rail. */
function Item({ label, on, done, icon: Icon, onClick }: { label: string; on: boolean; done?: boolean; icon?: typeof StartIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={on ? 'step' : undefined}
      onClick={onClick}
      className={`group flex h-9 w-full items-center gap-3 rounded-button px-3 text-left transition-colors duration-150 focus-mark motion-reduce:transition-none ${
        on ? 'bg-pressed type-label text-zebra-950' : 'type-body text-zebra-600 hover:bg-hover hover:text-zebra-950'
      }`}
    >
      {done ? (
        <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-grass-600" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
      ) : (
        // An unfinished part: an empty ring, the tick's outline.
        <span aria-hidden="true" className="size-4 shrink-0 rounded-pill border-[1.5px] border-zebra-300" />
      )}
      <span className="min-w-0 truncate">{label}</span>
      {done ? <span className="sr-only">, done</span> : null}
    </button>
  );
}

/** The rail. See {@link CoupleFormRailProps}. */
export function CoupleFormRail({ parts, screen, onGo }: CoupleFormRailProps) {
  const groups = parts.reduce<{ name: string; parts: FormPart[] }[]>((all, part) => {
    const last = all[all.length - 1];
    if (last?.name === part.group) last.parts.push(part);
    else all.push({ name: part.group, parts: [part] });
    return all;
  }, []);
  return (
    <nav aria-label="Parts of the form" className="space-y-4">
      <Item label="Before you start" icon={StartIcon} on={screen.kind === 'welcome'} onClick={() => onGo({ kind: 'welcome' })} />
      {groups.map((g) => (
        <div key={g.name} className="space-y-0.5">
          <GroupLabel className="px-3 pb-1">{g.name}</GroupLabel>
          {g.parts.map((part) => (
            <Item key={part.at} label={part.label} done={part.done} on={screen.kind === 'part' && screen.at === part.at} onClick={() => onGo({ kind: 'part', at: part.at })} />
          ))}
        </div>
      ))}
      <Item label="Check and send" icon={FileCheckIcon} on={screen.kind === 'review'} onClick={() => onGo({ kind: 'review' })} />
    </nav>
  );
}
