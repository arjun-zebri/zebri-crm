'use client';

import { GroupLabel } from '@/components/ui-v2/group-label';
import { Timeline, type TimelineStep } from '@/components/ui-v2/timeline';

import { dayMonth } from '../payments/dates';
import { ReadBack } from '../questionnaires/read-back';

import { dayText, lodgeBy, married, orderText, weddingDate, weddingDay, type Paperwork, type Stage } from './bdm-data';
import { useCelebrant } from './bdm-store';

/**
 * The paperwork's side: the facts of it on the read-back grid (the
 * wedding, the celebrant, the registration and certificate once there
 * are any), then its history as a `Timeline`, from sent to registered,
 * with what is next and when it is due (user, 2026-10-15: the column was
 * two lines and a third of the dialog). The notice has to be signed at
 * least a month before the wedding (Marriage Act 1961, s 42), so until it
 * is, that date is the one shown; once it has passed unsigned, a line
 * says what to do about it.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/paperwork-side
 */

export interface PaperworkSideProps {
  paper: Paperwork;
  /**
   * The Celebrant's name to show instead of the signed-in one's: the
   * marketing site's picture of this panel shows its demo Celebrant, never
   * the account behind the demo store.
   */
  celebrant?: string | undefined;
}

const ORDER: Stage[] = ['draft', 'sent', 'returned', 'checked', 'lodged', 'registered'];

/** The last day the notice can be signed: a month before the wedding. Null without a date. */
export function noticeBy(p: Paperwork): Date | null {
  const at = weddingDate(p);
  if (!at) return null;
  at.setMonth(at.getMonth() - 1);
  return at;
}

/** The facts that are known, as label and value. */
function factsOf(p: Paperwork, celebrant: string): [string, string][] {
  const order = p.order ? orderText(p.order) : '';
  const certificate = p.certificate === 'posted' ? `Sent · ${order}` : p.certificate === 'ordered' ? `Ordered · ${order}${p.application ? ` · ${p.application}` : ''}` : null;
  // Only what is known: "Date to come · Venue to come" wrapped onto two lines and said nothing.
  const wedding = [p.date, p.venue].filter((v) => v.trim() && !/to come$/i.test(v)).join(' · ') || 'Not set yet';
  const facts: [string, string | null | undefined][] = [
    ['Wedding', wedding],
    // Blank until the celebrant fills in Settings > Lodge with BDM; a label with nothing beside it read as broken.
    ['Celebrant', celebrant.trim() || null],
    ['Notification', p.notification],
    ['Registration', p.registration],
    ['Certificate', certificate],
  ];
  return facts.filter((f): f is [string, string] => Boolean(f[1]));
}

/** Its history and what is next. */
export function historyOf(p: Paperwork, now = new Date()): TimelineStep[] {
  const at = ORDER.indexOf(p.stage);
  const state = (stage: Stage): TimelineStep['state'] => (at >= ORDER.indexOf(stage) ? 'done' : at === ORDER.indexOf(stage) - 1 ? 'now' : 'later');
  const by = (d: Date | null) => (d ? `by ${dayText(d)}` : undefined);
  const wed = married(p, now);
  const steps: TimelineStep[] = [
    { label: 'Sent to the couple', when: p.sentOn, state: state('sent') },
    ...(p.remindedOn ? [{ label: 'Reminded', when: p.remindedOn, state: 'done' as const }] : []),
    { label: 'Answers back', when: p.returnedOn ? dayMonth(p.returnedOn) : undefined, state: state('returned') },
    { label: 'Notice signed', when: at < ORDER.indexOf('checked') ? by(noticeBy(p)) : undefined, state: state('checked') },
    { label: 'Wedding', when: weddingDate(p) ? weddingDay(p) : undefined, state: wed ? 'done' : at >= ORDER.indexOf('checked') ? 'now' : 'later' },
    { label: 'Lodged with BDM', when: p.lodgedOn ?? (wed ? by(lodgeBy(p)) : undefined), state: at >= ORDER.indexOf('lodged') ? 'done' : wed && at === ORDER.indexOf('checked') ? 'now' : 'later' },
    { label: 'Registered', state: state('registered') },
  ];
  // Only one step is "now": before the day, the wedding waits on the notice.
  return steps.map((s, i) => (s.state === 'now' && steps.slice(0, i).some((x) => x.state === 'now') ? { ...s, state: 'later' } : s));
}

/** The side. See {@link PaperworkSideProps}. */
export function PaperworkSide({ paper: p, celebrant }: PaperworkSideProps) {
  const c = useCelebrant();
  const due = noticeBy(p);
  const late = due && due < new Date() && ORDER.indexOf(p.stage) < ORDER.indexOf('checked');
  return (
    // 16px down, not the body's 12: the step tracker's row is 28px to these
    // 20px lines, so the first fact sits level with the steps beside it.
    <div className="flex-1 space-y-8 px-6 pb-6 pt-4 sm:px-8">
      <ReadBack compact rows={factsOf(p, celebrant ?? [c.title, c.givenName, c.familyName].filter(Boolean).join(' '))} />
      <div className="space-y-3">
        <GroupLabel as="h3">History</GroupLabel>
        <Timeline label="History" steps={historyOf(p)} />
        {late ? (
          <p className="type-body text-warning-ink">
            The notice had to be signed a month before the wedding. To marry on the day, they need a prescribed authority to shorten the time.
          </p>
        ) : null}
      </div>
    </div>
  );
}
