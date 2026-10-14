/**
 * Editor state for one sequence.
 *
 * The editor works on a local draft with throwaway row keys, so steps
 * and variants can be added, removed and reordered before anything is
 * saved. Database ids are carried through, so saving edits the sequence
 * in place and sent history stays linked to its steps and variants.
 *
 * Pure: no React, so the save payload and the checks can be tested alone.
 *
 * @module features/outreach/views/sequences/sequence-draft
 */
import type { SequenceWithSteps } from '@/lib/outreach/services/queries';

/** Channel a step is sent on. */
export type Channel = 'email' | 'instagram';

/** One A/B/C variant of a step, as edited. */
export interface DraftVariant {
  /** Local row key. Never sent to the server. */
  key: string;
  /** Database id, present when the variant already exists. */
  id?: string;
  /**
   * A, B, C... Fixed once assigned: analytics report results per label,
   * so a label must never move to a different message.
   */
  label: string;
  subject: string;
  body: string;
  weight: number;
  active: boolean;
  /** Messages already sent from this variant. Above zero, it can be switched off but not removed. */
  sentCount: number;
}

/** Editable fields of a step (everything except its key, id and variants). */
export type StepPatch = Partial<Pick<DraftStep, 'channel' | 'delay_days' | 'is_new_thread'>>;

/** Editable fields of a variant. */
export type VariantPatch = Partial<Pick<DraftVariant, 'subject' | 'body' | 'weight' | 'active'>>;

/** One step of a sequence, as edited. */
export interface DraftStep {
  /** Local row key. Never sent to the server. */
  key: string;
  /** Database id, present when the step already exists. */
  id?: string;
  channel: Channel;
  delay_days: number;
  is_new_thread: boolean;
  variants: DraftVariant[];
  /** Labels this step had when loaded, so a removed one is never reused. */
  usedLabels: string[];
  /** Messages already sent from this step. Above zero, the step cannot be removed (the server refuses). */
  sentCount: number;
}

/** A whole sequence, as edited. */
export interface DraftSequence {
  id?: string;
  name: string;
  steps: DraftStep[];
}

/** Matches saveSequenceSchema; the editor stops adding past these. */
export const MAX_STEPS = 10;
/** Matches saveSequenceSchema; the editor stops adding past this. */
export const MAX_VARIANTS = 6;

let keySeq = 0;

/** A fresh local key for a row. Module-level counter; the editor is client-only. */
export function newKey(): string {
  keySeq += 1;
  return `row-${keySeq}`;
}

/**
 * The label for a new variant: the letter after the highest one this step
 * has ever had (in the draft or when loaded). Labels are never typed by
 * hand and never reused, so removing B and adding one gives C, not B.
 */
export function nextVariantLabel(step: Pick<DraftStep, 'variants' | 'usedLabels'>): string {
  const codes = [...step.usedLabels, ...step.variants.map((v) => v.label)]
    .filter((l) => /^[A-Z]$/.test(l))
    .map((l) => l.charCodeAt(0));
  return String.fromCharCode(codes.length ? Math.min(90, Math.max(...codes) + 1) : 65);
}

/**
 * True when a step starts a new email thread. The first step always
 * does, so the first email is never a reply to nothing. Instagram steps
 * never start an email thread.
 */
export function startsThread(step: Pick<DraftStep, 'channel' | 'is_new_thread'>, index: number): boolean {
  return step.channel === 'email' && (index === 0 || step.is_new_thread);
}

/** A variant with no text yet. Weight 50 gives a fair split when there are two. */
export function blankVariant(label = 'A', weight = 50): DraftVariant {
  return { key: newKey(), label, subject: '', body: '', weight, active: true, sentCount: 0 };
}

/** A step with one blank variant. The first step waits 0 days, later ones 1. */
export function blankStep(channel: Channel, delayDays: number): DraftStep {
  return {
    key: newKey(), channel, delay_days: delayDays, is_new_thread: false, variants: [blankVariant()], usedLabels: [], sentCount: 0,
  };
}

/**
 * True when the draft differs from the one the editor opened with. Compared
 * structurally: row keys are stable across edits, so unchanged rows match.
 */
export function isDraftChanged(draft: DraftSequence, initial: DraftSequence): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

/** An empty sequence with one email step. */
export function blankSequence(): DraftSequence {
  return { name: '', steps: [blankStep('email', 0)] };
}

/** Turn a saved sequence into an editable draft, keeping every database id. */
export function draftFromSequence(seq: SequenceWithSteps): DraftSequence {
  return {
    id: seq.id,
    name: seq.name,
    steps: seq.steps.map((st) => ({
      key: newKey(),
      id: st.id,
      channel: st.channel === 'instagram' ? 'instagram' : 'email',
      delay_days: st.delay_days,
      is_new_thread: st.is_new_thread,
      usedLabels: st.variants.map((v) => v.label),
      sentCount: st.sent_count,
      variants: st.variants.map((v) => ({
        key: newKey(),
        id: v.id,
        label: v.label,
        subject: v.subject ?? '',
        body: v.body,
        weight: v.weight,
        active: v.active,
        sentCount: v.sent_count,
      })),
    })),
  };
}
