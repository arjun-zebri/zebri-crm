/**
 * Review before send.
 *
 * An automated step can be marked "ask me first". When it falls due it
 * does not run: it surfaces in the MC's Today view with a preview of
 * exactly what would go out, and waits for Send, Edit or Skip.
 *
 * This replaces the old approval-by-email gate, which sent a tokenised
 * link to an inbox and, after the automations engine was retired, had no
 * route left to answer it. Reviewing in the app is both safer (no token
 * in an email) and better: the MC sees the rendered email, for that
 * couple, with their real details in it, and can fix a word before it
 * goes.
 *
 * The gate itself is `workflow_steps.requires_approval`, which
 * `isExecutable` already refuses to run past. Nothing here needs a new
 * column: a step "needs review" when it is automated, pending, due, and
 * still flagged.
 *
 * @module lib/workflows/review
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { actionUi } from '@/lib/automations/actions/ui';
import { docToText } from '@/lib/automations/mustache-doc';
import { renderTemplate } from '@/lib/automations/variables';
import type { ActionType, RunContext } from '@/types/automations';
import type { Database, Json } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { isAutomated } from './steps';

/**
 * Is this step sitting in front of the MC waiting for a yes?
 *
 * Pure, and exported so the Today view, the couple checklist and the
 * tests all agree on one definition.
 */
export function needsReview(step: WorkflowStepRow, now: Date): boolean {
  if (!isAutomated(step.type)) return false;
  if (step.status !== 'pending') return false;
  if (!step.requires_approval) return false;
  if (step.due_at === null) return false;
  return new Date(step.due_at).getTime() <= now.getTime();
}

/** What the MC is being asked to approve. */
export interface StepPreview {
  /** `email` renders subject + body; `other` renders the summary alone. */
  kind: 'email' | 'other';
  /** One line naming what this step does, always present. */
  summary: string;
  /** Rendered subject, with the couple's details substituted. */
  subject?: string;
  /** Rendered plain-text body, with the couple's details substituted. */
  body?: string;
  /** True when the body came from a saved template rather than the step. */
  fromTemplate?: boolean;
  /** Variables that could not be resolved. A send with these is risky. */
  unresolved?: string[];
}

/** Tokens still sitting unreplaced after a render. */
function unresolvedTokens(rendered: string): string[] {
  const matches = rendered.match(/\{\{\s*[^}]+\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

/**
 * Load a saved email template's subject and body text.
 *
 * Reads through the caller's RLS-scoped client, not the admin client:
 * a preview is a user-initiated read and has no business escalating.
 */
async function loadTemplateParts(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<{ subject: string; body: string } | null> {
  const { data } = await supabase
    .from('email_templates')
    .select('subject, content')
    .eq('id', templateId)
    .maybeSingle();
  if (!data) return null;
  return {
    subject: data.subject ?? '',
    body: docToText(data.content as never),
  };
}

/**
 * Build the preview for one step awaiting review.
 *
 * Renders through the same `renderTemplate` the send path uses, against
 * the same context, so what the MC reads here is what the couple gets.
 *
 * @param supabase - RLS-scoped client for the reviewing user
 * @param step - the step awaiting review
 * @param ctx - the run context the executor would have used
 */
export async function buildStepPreview(
  supabase: SupabaseClient<Database>,
  step: WorkflowStepRow,
  ctx: RunContext,
): Promise<StepPreview> {
  const config = (step.config ?? {}) as Record<string, unknown>;
  const actionType = typeof config['actionType'] === 'string' ? config['actionType'] : null;

  if (step.type !== 'action' || actionType !== 'send_email') {
    const label =
      actionType && actionUi[actionType as ActionType]
        ? actionUi[actionType as ActionType]!.label
        : (step.title || 'This step');
    return { kind: 'other', summary: label };
  }

  let rawSubject = typeof config['subject'] === 'string' ? config['subject'] : '';
  // `content` is the rich TipTap body the composer writes; `body` is the
  // legacy plain string from before it existed. Steps of both vintages
  // are in the wild, so read whichever is present.
  let rawBody = config['content']
    ? docToText(config['content'] as never)
    : typeof config['body'] === 'string'
      ? config['body']
      : '';
  let fromTemplate = false;

  if (typeof config['templateId'] === 'string') {
    const parts = await loadTemplateParts(supabase, config['templateId']);
    if (parts) {
      rawSubject = parts.subject;
      rawBody = parts.body;
      fromTemplate = true;
    }
  }

  const subject = renderTemplate(rawSubject, ctx);
  const body = renderTemplate(rawBody, ctx);
  const unresolved = [...unresolvedTokens(subject), ...unresolvedTokens(body)];

  return {
    kind: 'email',
    summary: 'Send an email',
    subject,
    body,
    fromTemplate,
    ...(unresolved.length > 0 ? { unresolved: Array.from(new Set(unresolved)) } : {}),
  };
}

/**
 * Apply an MC's edits to a step's inline email config.
 *
 * Editing at review time writes the subject and body back onto the step,
 * never onto the saved template: the MC is fixing this one send for this
 * one couple, not rewriting the wording for everybody. Switching a
 * template-backed step to edited copy therefore also drops `templateId`,
 * so the send uses what is on screen.
 */
export function applyReviewEdits(
  config: Json,
  edits: { subject: string; body: string },
): Json {
  const rest = { ...((config ?? {}) as Record<string, unknown>) };
  // The legacy plain-string `body` goes too: leaving it beside a fresh
  // `content` would let the send path pick the stale copy.
  delete rest['templateId'];
  delete rest['body'];
  return {
    ...rest,
    subject: edits.subject,
    // The composer stores a TipTap doc; edited plain text becomes a doc
    // of one paragraph per line so the send path renders it unchanged.
    content: {
      type: 'doc',
      content: edits.body.split('\n').map((line) => ({
        type: 'paragraph',
        ...(line.length > 0 ? { content: [{ type: 'text', text: line }] } : {}),
      })),
    },
  } as Json;
}
