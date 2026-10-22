'use client';

import { useState } from 'react';

import { ClockIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';

import { span, type TimeUnit } from '../pages/dashboard/journeys/timing';

import { same, type Anchor, type RelTime } from './model';

/**
 * When a step goes out, typed or picked. The field takes plain words
 * ("3 days after", "8w before", "right away", "I'll send it") and lists
 * what they could mean under it, so nothing is a guess: a bare "3 days"
 * offers after signing, before the wedding and after it. Enter takes the
 * first. Under that, four usual times, narrowed as you type, so the
 * common case is one click. Four at most either way: more read as a wall
 * of choices. Everything is one column of menu rows at a menu's narrow
 * width (it sits in a `menu` Popover): the sentence the time makes shows
 * on whatever opened it, so a row only needs the short form.
 *
 * The caller says what a time can count from (`anchors`), whether "right
 * away" and "you send it" are allowed, which four are the usual ones and
 * how a row reads, so the same picker sets when a journey step goes out
 * ("3 days after they sign the contract") and when a follow-up happens
 * ("Remind them after 3 days").
 *
 * @module app/design-system/v2/relative-time/relative-time-picker
 */

/** The usual times when the caller gives none. */
const QUICK: RelTime[] = [
  { anchor: 'previous', amount: 0, unit: 'days' },
  { anchor: 'previous', amount: 3, unit: 'days' },
  { anchor: 'previous', amount: 1, unit: 'weeks' },
  { anchor: 'before', amount: 8, unit: 'weeks' },
];

/** A time as its row reads by default: short, the sentence on the trigger says the rest. */
export function chipOf(t: RelTime): string {
  if (t.anchor === 'manual') return 'You send it';
  if (t.anchor === 'previous') return t.amount ? `${span(t.amount, t.unit)} after` : 'Right away';
  return `${span(t.amount, t.unit)} ${t.anchor === 'before' ? 'before' : 'after the event'}`;
}

const UNIT: Record<string, TimeUnit> = { d: 'days', w: 'weeks', m: 'months' };

/** The unit a typed word names: "min"/"mins" are minutes, any other m-word months, then days and weeks by first letter. */
const unitOf = (word: string): TimeUnit | undefined => (word.startsWith('mi') ? 'minutes' : UNIT[word[0] ?? '']);

/** What a time may be: which anchors, and whether "right away" and "you send it" count. */
export interface TimeRules {
  anchors?: readonly Anchor[] | undefined;
  /** "Right away" (an amount of 0). Defaults to true. */
  now?: boolean | undefined;
  /** "You send it". Defaults to true. */
  manual?: boolean | undefined;
}

/** Up to four times the words could mean under the rules, likeliest first; empty when they say nothing usable. */
export function candidates(text: string, { anchors: allowed = ['previous', 'before', 'after'], now = true, manual = true }: TimeRules = {}): RelTime[] {
  const s = text.toLowerCase().trim();
  if (!s) return [];
  if (/send|manual|myself|i'?ll|^me$/.test(s)) return manual ? [{ anchor: 'manual' }] : [];
  if (/right away|straight|as soon|immediately|^now/.test(s)) return now && allowed.includes('previous') ? [{ anchor: 'previous', amount: 0, unit: 'days' }] : [];
  const m = /(\d{1,3})\s*([a-z]*)/.exec(s);
  if (!m) return [];
  const amount = Number(m[1]);
  if (amount < 1) return [];
  const unit = unitOf(m[2] ?? '');
  const units: TimeUnit[] = unit ? [unit] : ['days', 'weeks', 'minutes'];
  const rest = s.slice(m.index + m[0].length);
  // Half-typed words count ("bef", "aft the wed"): the list updates as they type.
  const said: Anchor[] = /\bbe/.test(rest) ? ['before'] : /\bwe|\bev|day of/.test(rest) ? ['after'] : /\baf/.test(rest) ? ['previous', 'after'] : ['previous', 'before', 'after'];
  const anchors = said.filter((a) => allowed.includes(a));
  // Months after signing reads as a mistake; that span is the wedding's. Minutes only count from the step
  // before ("20 minutes after the thank-you"): minutes before or after the event is the day itself.
  const fits = (anchor: Anchor, u: TimeUnit) => (anchor === 'previous' ? u !== 'months' : u !== 'minutes');
  return anchors.flatMap((anchor) => units.filter((u) => fits(anchor, u)).map((u) => ({ anchor, amount, unit: u }))).slice(0, 4);
}

export interface RelativeTimePickerProps extends TimeRules {
  /** The time set now, ticked; none for a new one. */
  value?: RelTime | undefined;
  onChange: (value: RelTime) => void;
  /** The four usual times, as chips. */
  quick?: readonly RelTime[] | undefined;
  /** A time as its row reads. Defaults to {@link chipOf}. */
  short?: ((t: RelTime) => string) | undefined;
  /** The field's placeholder. */
  placeholder?: string | undefined;
}

/** The picker. See {@link RelativeTimePickerProps}. */
export function RelativeTimePicker({ value, onChange, quick: usual = QUICK, short = chipOf, placeholder = 'Type a time', ...rules }: RelativeTimePickerProps) {
  const [text, setText] = useState('');
  const rows = candidates(text, rules);
  const q = text.toLowerCase().trim();
  const quick = (q ? usual.filter((t) => short(t).toLowerCase().includes(q)) : usual).slice(0, 4);
  const isValue = (t: RelTime) => Boolean(value && same(t, value));
  const pick = (t: RelTime) => {
    onChange(t);
    setText('');
  };
  const row = (t: RelTime, hint?: string) => (
    <MenuOption key={short(t)} selected={isValue(t)} description={hint} onSelect={() => pick(t)}>
      {short(t)}
    </MenuOption>
  );
  return (
    <div className="w-56">
      <form
        className="px-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (rows[0]) pick(rows[0]);
        }}
      >
        <Input icon={ClockIcon} autoFocus aria-label="Time" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      </form>
      {rows.length ? (
        <div role="menu" aria-label="Did you mean" className="pt-1">
          {rows.map((t, i) => row(t, i === 0 ? 'Press Enter' : undefined))}
        </div>
      ) : text && !quick.length ? (
        <p className="px-2 py-1.5 type-body text-zebra-500">Try a number with minutes, days or weeks.</p>
      ) : null}
      {quick.length ? (
        <div role="menu" aria-label="Usual times" className="pt-1">
          <p className="px-2 pb-1 pt-2 type-body text-zebra-500">{rows.length ? 'Or a usual time' : 'Usual times'}</p>
          {quick.map((t) => row(t))}
        </div>
      ) : null}
    </div>
  );
}
