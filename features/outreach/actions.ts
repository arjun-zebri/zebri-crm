'use server';

/**
 * Server actions behind Admin > Outreach.
 *
 * Every action: `assertAdmin()` first (the service-role client below
 * bypasses RLS, and the outreach tables deny everyone else outright),
 * then Zod, then one service call. Failures come back as
 * {@link ActionResult} values; only `OutreachUserError` messages reach
 * the UI verbatim, anything else is logged and genericised.
 *
 * @module features/outreach/actions
 */
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/assert-admin';
import { recordAdminAction } from '@/lib/admin/audit';
import { logger } from '@/lib/alerts/logger';
import { buildManualProspect } from '@/lib/outreach/import/manual';
import { buildProspects, guessColumns, parseSheet, type SheetMapping } from '@/lib/outreach/import/sheet';
import { addProspect } from '@/lib/outreach/services/add-prospect';
import {
  archiveSequence, igCantDm, igCopied, igSent, igSkip, linkUser, logTouch, markReplied, OutreachUserError,
  retryMessage, saveCampaign, saveSequence, setCampaignStatus, setVerdicts, undoOptOut, updateProspect,
} from '@/lib/outreach/services/admin-ops';
import { cancelRun, processCheckBatch, startActivityRun } from '@/lib/outreach/services/checks';
import { deleteCampaign, deleteProspect, deleteSequence } from '@/lib/outreach/services/deletes';
import { stopActiveEnrollment } from '@/lib/outreach/services/events';
import { importProspects, previewImport, type ImportOutcome } from '@/lib/outreach/services/import';
import { pollMailbox } from '@/lib/outreach/services/poll';
import {
  countAudience, listProspects, loadAnalytics, loadCampaigns, loadChecks, loadPipeline, loadProspect,
  loadReviewQueue, loadSequences, loadSettingsView, loadToday,
} from '@/lib/outreach/services/queries';
import { loadReadiness } from '@/lib/outreach/services/readiness';
import { disconnectMailbox, resumeSending, saveSettings } from '@/lib/outreach/services/settings';
import { loadSetupProgress } from '@/lib/outreach/services/setup-progress';
import { createAdminClient } from '@/lib/supabase/admin';

import type { ActionResult } from './action-result';
import {
  addProspectSchema, analyticsSchema, campaignStatusSchema, csvSchema, importSchema, linkUserSchema, logTouchSchema, markRepliedSchema,
  messageActionSchema, prospectFiltersSchema, runScopeSchema, saveCampaignSchema, saveSequenceSchema, saveSettingsSchema,
  setVerdictSchema, skipIgSchema, updateProspectSchema,
} from './schemas';

/** Batch calls from the open Prospects page stop starting work at this point. */
const BATCH_BUDGET_MS = 40_000;

/** Gate, validate, run; map failures to a toast-safe message. */
async function run<S extends z.ZodType, T>(
  name: string,
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>, adminId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  let adminId: string;
  try {
    adminId = (await assertAdmin()).id;
  } catch {
    return { ok: false, error: 'Admins only.' };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  try {
    return { ok: true, data: await fn(parsed.data, adminId) };
  } catch (err) {
    if (err instanceof OutreachUserError) return { ok: false, error: err.message };
    logger.error(`[outreach] ${name} failed`, err);
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

const none = z.undefined().or(z.null()).or(z.object({}).strict());
const db = () => createAdminClient();

// ───── Reads ──────────────────────────────────────────────────────────

/** Today view. */
export async function getTodayAction() {
  return run('today', none, undefined, () => loadToday(db()));
}

/** One page of prospects. */
export async function listProspectsAction(filters: unknown) {
  return run('listProspects', prospectFiltersSchema, filters, (f) => listProspects(db(), f));
}

/** Prospect modal. */
export async function getProspectAction(id: unknown) {
  return run('getProspect', z.uuid(), id, (pid) => loadProspect(db(), pid));
}

/** Checks view. */
export async function getChecksAction() {
  return run('checks', none, undefined, () => loadChecks(db()));
}

/** Needs-review queue. */
export async function getReviewQueueAction() {
  return run('reviewQueue', none, undefined, () => loadReviewQueue(db()));
}

/** Sequences with steps and variants. */
export async function getSequencesAction() {
  return run('sequences', none, undefined, () => loadSequences(db()));
}

/** Campaigns with arms and counts. */
export async function getCampaignsAction() {
  return run('campaigns', none, undefined, () => loadCampaigns(db()));
}

/** Live audience size for the campaign editor. */
export async function countAudienceAction(audience: unknown) {
  return run('countAudience', saveCampaignSchema.shape.audience, audience, (a) => countAudience(db(), a));
}

/** Pipeline board. */
export async function getPipelineAction() {
  return run('pipeline', none, undefined, () => loadPipeline(db()));
}

/** Analytics, optionally for one campaign. */
export async function getAnalyticsAction(input: unknown) {
  return run('analytics', analyticsSchema, input, (i) => loadAnalytics(db(), i.campaignId));
}

/** Settings view. */
export async function getSettingsAction() {
  return run('settings', none, undefined, (_d, adminId) => loadSettingsView(db(), adminId));
}

/** Ready-to-send checklist and the sending pause state. */
export async function getReadinessAction() {
  return run('readiness', none, undefined, () => loadReadiness(db()));
}

/** First-run setup guide: the five required steps and the optional row. */
export async function getSetupProgressAction() {
  return run('setupProgress', none, undefined, () => loadSetupProgress(db()));
}

/** Add one prospect by hand. Returns its id so the page can open it. */
export async function addProspectAction(input: unknown) {
  return run('addProspect', addProspectSchema, input, async (data) => {
    const built = buildManualProspect(data);
    if (!built.ok) throw new OutreachUserError(Object.values(built.errors)[0] ?? 'Check the details and try again.');
    return addProspect(db(), built.prospect, data.notes?.trim() || null);
  });
}

// ───── Import + checks ────────────────────────────────────────────────

/** Parse a CSV and propose a column mapping. */
export async function parseSheetAction(csv: unknown) {
  return run('parseSheet', csvSchema, csv, async (text) => {
    const grid = parseSheet(text);
    return { headers: grid.headers, sample: grid.rows.slice(0, 5), rowCount: grid.rows.length, mapping: guessColumns(grid.headers) };
  });
}

/** Preview new vs merged vs skipped for a mapping. */
export async function previewImportAction(input: unknown) {
  return run('previewImport', importSchema, input, async ({ csv, mapping }) => {
    const built = buildProspects(parseSheet(csv), mapping as SheetMapping);
    if (built.prospects.length === 0) throw new OutreachUserError('No rows have a name. Check the Name column mapping.');
    const preview = await previewImport(db(), built.prospects);
    return { ...preview, skipped: built.skipped.length, skippedNoName: built.skipped.filter((s) => s.reason === 'no_name').length };
  });
}

/** Run the import. */
export async function importSheetAction(input: unknown): Promise<ActionResult<ImportOutcome>> {
  return run('importSheet', importSchema, input, async ({ csv, mapping }, adminId) => {
    const built = buildProspects(parseSheet(csv), mapping as SheetMapping);
    const outcome = await importProspects(db(), built.prospects);
    await recordAdminAction({ actorId: adminId, targetUserId: null, action: 'outreach_import', details: { ...outcome } });
    return outcome;
  });
}

/** Start an activity check run. */
export async function startCheckRunAction(scope: unknown) {
  return run('startCheckRun', runScopeSchema, scope, (s) => startActivityRun(db(), s));
}

/** Process one batch (the open Prospects page calls this in a loop). */
export async function processCheckBatchAction() {
  return run('processCheckBatch', none, undefined, () => processCheckBatch(db(), Date.now() + BATCH_BUDGET_MS));
}

/** Cancel a run. */
export async function cancelCheckRunAction(runId: unknown) {
  return run('cancelCheckRun', z.uuid(), runId, (id) => cancelRun(db(), id));
}

/** Set verdicts by hand. */
export async function setVerdictAction(input: unknown) {
  return run('setVerdict', setVerdictSchema, input, ({ ids, verdict }) => setVerdicts(db(), ids, verdict));
}

// ───── Prospect edits ─────────────────────────────────────────────────

/** Save drawer edits. */
export async function updateProspectAction(input: unknown) {
  return run('updateProspect', updateProspectSchema, input, ({ id, patch }) => updateProspect(db(), id, patch));
}

/** Log a manual touch. */
export async function logTouchAction(input: unknown) {
  return run('logTouch', logTouchSchema, input, ({ id, kind, note }) => logTouch(db(), id, kind, note));
}

/** Mark a reply Zebri can't see. */
export async function markRepliedAction(input: unknown) {
  return run('markReplied', markRepliedSchema, input, ({ id, channel, note }) => markReplied(db(), id, channel, note));
}

/** Undo an opt-out. */
export async function undoOptOutAction(id: unknown) {
  return run('undoOptOut', z.uuid(), id, (pid) => undoOptOut(db(), pid));
}

/** Stop the prospect's sequence. */
export async function stopSequenceAction(id: unknown) {
  return run('stopSequence', z.uuid(), id, async (pid) => {
    await stopActiveEnrollment(db(), pid, 'manual', 'admin');
  });
}

/** Delete a prospect, with their messages and history. Opt-outs stay suppressed. */
export async function deleteProspectAction(id: unknown) {
  return run('deleteProspect', z.uuid(), id, (pid) => deleteProspect(db(), pid));
}

/** Link to a Zebri account. */
export async function linkUserAction(input: unknown) {
  return run('linkUser', linkUserSchema, input, ({ id, email }) => linkUser(db(), id, email));
}

// ───── IG queue + messages ────────────────────────────────────────────

/** Copied + opened. */
export async function igCopiedAction(input: unknown) {
  return run('igCopied', messageActionSchema, input, ({ messageId }) => igCopied(db(), messageId));
}

/** Sent. */
export async function igSentAction(input: unknown) {
  return run('igSent', messageActionSchema, input, ({ messageId }) => igSent(db(), messageId));
}

/** Skip. */
export async function igSkipAction(input: unknown) {
  return run('igSkip', skipIgSchema, input, ({ messageId, reason }) => igSkip(db(), messageId, reason));
}

/** Can't DM. */
export async function igCantDmAction(input: unknown) {
  return run('igCantDm', messageActionSchema, input, ({ messageId }) => igCantDm(db(), messageId));
}

/** Retry a failed email. */
export async function retryMessageAction(input: unknown) {
  return run('retryMessage', messageActionSchema, input, ({ messageId }) => retryMessage(db(), messageId));
}

/** Poll Gmail now instead of waiting for the tick. */
export async function checkRepliesNowAction() {
  return run('checkRepliesNow', none, undefined, () => pollMailbox(db(), Date.now() + BATCH_BUDGET_MS, true));
}

// ───── Sequences + campaigns ──────────────────────────────────────────

/** Save a sequence. */
export async function saveSequenceAction(input: unknown) {
  return run('saveSequence', saveSequenceSchema, input, (s) => saveSequence(db(), s));
}

/** Archive a sequence. */
export async function archiveSequenceAction(id: unknown) {
  return run('archiveSequence', z.uuid(), id, (sid) => archiveSequence(db(), sid));
}

/** Delete a sequence nobody has been through and no campaign uses. */
export async function deleteSequenceAction(id: unknown) {
  return run('deleteSequence', z.uuid(), id, (sid) => deleteSequence(db(), sid));
}

/** Save a campaign. */
export async function saveCampaignAction(input: unknown) {
  return run('saveCampaign', saveCampaignSchema, input, (c) => saveCampaign(db(), c));
}

/** Activate / pause / finish a campaign. */
export async function setCampaignStatusAction(input: unknown) {
  return run('setCampaignStatus', campaignStatusSchema, input, ({ id, status }) => setCampaignStatus(db(), id, status));
}

/** Delete a campaign that is not active and has sent nothing. */
export async function deleteCampaignAction(id: unknown) {
  return run('deleteCampaign', z.uuid(), id, (cid) => deleteCampaign(db(), cid));
}

// ───── Settings ───────────────────────────────────────────────────────

/** Save settings. */
export async function saveSettingsAction(input: unknown) {
  return run('saveSettings', saveSettingsSchema, input, (s) => saveSettings(db(), s));
}

/** Resume sending. */
export async function resumeSendingAction() {
  return run('resumeSending', none, undefined, () => resumeSending(db()));
}

/** Disconnect the mailbox. */
export async function disconnectMailboxAction() {
  return run('disconnectMailbox', none, undefined, async (_d, adminId) => {
    await disconnectMailbox(db());
    await recordAdminAction({ actorId: adminId, targetUserId: null, action: 'outreach_mailbox_disconnect', details: {} });
  });
}

/**
 * Why sending is blocked (or that it is running), for the Today header.
 * The service import is dynamic so this file's import block stays as the
 * other outreach work left it.
 */
export async function getSendStatusAction() {
  return run('sendStatus', none, undefined, async () => {
    const { loadSendStatus } = await import('@/lib/outreach/services/send-status');
    return loadSendStatus(db());
  });
}
