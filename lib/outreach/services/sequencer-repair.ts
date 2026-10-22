/**
 * Finish active enrolments that have nothing scheduled.
 *
 * An enrolment is written before its first step is scheduled, and a step
 * that fails (or is skipped on a send error) can leave the same gap. Without
 * this pass, such an enrolment would sit active forever and block the
 * candidates query, since one live enrolment per person is enforced.
 *
 * It resumes from the highest step position already written, cancelled
 * steps included: those were decided, and walking past them lets the
 * sequence drain to completed instead of looping on the same step.
 *
 * @module lib/outreach/services/sequencer-repair
 */
import type { AdminDb } from '../types';

import { advanceAfter, loadScheduleContext } from './sequencer';

/** Highest step position among the enrolment's messages (0 when none). */
async function lastPosition(db: AdminDb, enrollmentId: string): Promise<number> {
  const { data: msgs, error } = await db.from('outreach_messages').select('step_id').eq('enrollment_id', enrollmentId);
  if (error) throw new Error(`repair messages: ${error.message}`);
  const stepIds = [...new Set((msgs ?? []).map((m) => m.step_id))];
  if (stepIds.length === 0) return 0;
  const { data: steps, error: sErr } = await db.from('outreach_sequence_steps').select('position').in('id', stepIds);
  if (sErr) throw new Error(`repair steps: ${sErr.message}`);
  return Math.max(0, ...(steps ?? []).map((s) => s.position));
}

/**
 * Schedule the next step for up to `limit` stranded enrolments.
 * Idempotent: the unique index on (enrollment, step) makes a repeat a no-op.
 *
 * @returns how many enrolments were examined.
 */
export async function repairStrandedEnrolments(db: AdminDb, limit = 50): Promise<number> {
  const { data: stranded, error } = await db.rpc('outreach_stranded_enrolments', { p_limit: limit });
  if (error) throw new Error(`stranded enrolments: ${error.message}`);
  if (!stranded?.length) return 0;

  const ctx = await loadScheduleContext(db);
  let repaired = 0;
  for (const row of stranded) {
    const { data: enrollment, error: eErr } = await db.from('outreach_enrollments').select('*').eq('id', row.enrollment_id).single();
    if (eErr) throw new Error(`repair enrolment: ${eErr.message}`);
    if (enrollment.status !== 'active') continue;
    const { data: prospect, error: pErr } = await db.from('outreach_prospects').select('*').eq('id', enrollment.prospect_id).single();
    if (pErr) throw new Error(`repair prospect: ${pErr.message}`);
    await advanceAfter(db, ctx, enrollment, prospect, await lastPosition(db, enrollment.id), new Date());
    repaired++;
  }
  return repaired;
}
