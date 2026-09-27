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
import type { JSONContent } from '@tiptap/react';

import { actionUi } from '@/lib/automations/actions/ui';
import { textToDoc } from '@/lib/automations/mustache-doc';
import { isKnownVariable, variableLabel } from '@/lib/automations/variables';
import { templateFileIds } from '@/lib/email/send-context';
import {
  PREVIEW_UNSUBSCRIBE_URL,
  recipientCopyHtml,
  renderSendEmail,
  selectSendEmailSource,
} from '@/lib/email/send-email-render';
import { renderEmailSubject } from '@/lib/email/templates';
import type { ActionType, RunContext } from '@/types/automations';
import type { Database, Json } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { buildPrecomposedEnvelope, precomposedEmail } from './precomposed-envelope';
import { buildEnvelopePatch, buildSendEnvelope, type EnvelopePatch, type SendEnvelope } from './send-envelope';

/**
 * Re-exported from `./needs-review`, where it lives so client code can
 * read it without bundling this server-side module.
 */
export { needsReview } from './needs-review';

/** What the MC is being asked to approve. */
export interface StepPreview {
  /** `email` renders subject + body; `other` renders the summary alone. */
  kind: 'email' | 'other';
  /** One line naming what this step does, always present. */
  summary: string;
  /**
   * Rendered subject, with the couple's details substituted, exactly as
   * it is sent (a gap is blank). Seeds the detail modal's subject field.
   */
  subject?: string;
  /**
   * The subject for display when something in it could not be filled:
   * the gap reads `[Event date]` instead of vanishing. Absent when the
   * subject is complete, so the header shows {@link StepPreview.subject}.
   */
  subjectPreview?: string;
  /**
   * The message as written, for the detail modal's editor: the subject
   * with its `{{variables}}` and the body as a TipTap doc with its
   * variable, link and list nodes. Editing the source rather than the
   * rendered text is what keeps an edit rich and an unfilled variable
   * still a variable (live check B2). What the couple receives is
   * {@link StepPreview.html}.
   */
  source?: EditableEmailSource;
  /**
   * The whole email exactly as the send renders it: the branded shell,
   * the signature, the preheader and the legal footer. Its unsubscribe
   * link is the inert {@link PREVIEW_UNSUBSCRIBE_URL}, never a real token.
   * A variable that could not be filled is shown as a highlighted label
   * here, where the send leaves it blank (legacy text) or does not send.
   */
  html?: string;
  /** True when the body came from a saved template rather than the step. */
  fromTemplate?: boolean;
  /**
   * A pre-composed email (portal link, questionnaire, contract, run
   * sheet, post-event notes), in words: what it sends. Its wording is
   * composed inside the send and not previewed yet, so the MC is told
   * that, with who it goes to, instead of reading a bare label (I3).
   */
  precomposed?: string;
  /**
   * Variables Zebri knows that this couple could not fill, by their
   * readable label. When the body is rich text a send with these does
   * not go out: it parks until the MC fills the gap.
   */
  unresolved?: string[];
  /**
   * Variables Zebri does not know at all (a typo, or `event.venue` for
   * `venue.name`), by path. No detail on the couple can ever fill them;
   * only editing the message can (live check B7). They hold a rich-text
   * send like any other gap.
   */
  unknown?: string[];
  /**
   * With {@link StepPreview.unresolved} or {@link StepPreview.unknown}:
   * true when those gaps stop the send (a rich-text body parks until they
   * are filled), false when it goes with them blank (a legacy plain-text
   * body). The send's own `blocked` rule, not a guess.
   */
  unresolvedHolds?: boolean;
  /**
   * Sender, recipients (and who is skipped), reply-to, send time and
   * attachments, decided by the send's own functions. Step previews only;
   * absent if it could not be read, and on a preview with edits, which
   * carries {@link StepPreview.envelopePatch} instead.
   */
  envelope?: SendEnvelope;
  /**
   * On a preview with edits only: the envelope fields an edit can change,
   * to lay over the saved step's envelope (see `buildEnvelopePatch`).
   */
  envelopePatch?: EnvelopePatch;
}

/** A held send's message as written, for the detail modal's editor. */
export interface EditableEmailSource {
  /** The subject as written, `{{variables}}` and all. */
  subject: string;
  /** The body as a TipTap doc, the shape the Compose editor edits. */
  content: JSONContent;
  /**
   * True when the step stores a pre-composer plain-text body, lifted into
   * a doc here for the editor. Untouched, it keeps sending as plain text
   * (a gap goes out blank); edited, it is saved as rich text, as the
   * Compose modal saves it, and from then on a gap holds the send.
   */
  legacyText: boolean;
}

/**
 * The MC's pending edits to a held send. Per field: only what the MC
 * changed is present, so a subject edit leaves the body exactly as it was
 * stored (live check B2). `content` is a TipTap doc from the editor, run
 * through `toPlainJSON` before it crosses the server-action boundary.
 */
export interface ReviewEdits {
  subject?: string;
  content?: JSONContent;
}

/**
 * Load a saved email template's subject and body.
 *
 * Reads through the caller's RLS-scoped client, not the admin client:
 * a preview is a user-initiated read and has no business escalating, and
 * a template another tenant owns reads as not found.
 */
export async function loadTemplateParts(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<{ subject: string; content: JSONContent } | null> {
  const { data } = await supabase
    .from('email_templates')
    .select('subject, content')
    .eq('id', templateId)
    .maybeSingle();
  if (!data) return null;
  return { subject: data.subject ?? '', content: (data.content ?? {}) as JSONContent };
}

/**
 * Build the preview for one step awaiting review.
 *
 * Renders through `lib/email/send-email-render`, the same functions the
 * send calls, against the same context, so the HTML here is byte for
 * byte what the couple receives apart from the unsubscribe token. With
 * `edits`, it previews the step as approving those edits would leave it
 * (the same {@link applyReviewEdits} the approve action writes).
 *
 * Side-effect free by design: nothing is dispatched, logged, counted
 * against the send cap, or minted.
 *
 * @param supabase - RLS-scoped client for the reviewing user
 * @param step - the step awaiting review
 * @param ctx - the run context the executor would have used
 * @param edits - the MC's unsaved subject and body, when they have typed
 */
export async function buildStepPreview(
  supabase: SupabaseClient<Database>,
  step: WorkflowStepRow,
  ctx: RunContext,
  edits?: ReviewEdits,
): Promise<StepPreview> {
  const stored = (step.config ?? {}) as Record<string, unknown>;
  const actionType = typeof stored['actionType'] === 'string' ? stored['actionType'] : null;

  if (step.type !== 'action' || actionType !== 'send_email') {
    const label =
      actionType && actionUi[actionType as ActionType]
        ? actionUi[actionType as ActionType]!.label
        : (step.title || 'This step');
    const sends = step.type === 'action' ? precomposedEmail(actionType) : null;
    if (!sends || !actionType) return { kind: 'other', summary: label };
    // A pre-composed email: what it is, who it goes to, and plainly that
    // its preview is not available yet (I3). Its envelope degrades like
    // the send_email one: a failed read shows the rest without it.
    try {
      const envelope = await buildPrecomposedEnvelope({ supabase, step, ctx, actionType, config: stored });
      return { kind: 'other', summary: label, precomposed: sends, ...(envelope ? { envelope } : {}) };
    } catch (err) {
      console.error('[workflows] pre-composed envelope failed', step.id, err);
      return { kind: 'other', summary: label, precomposed: sends };
    }
  }

  // The saved template is read first: an edit to a template-backed step
  // is applied over the template's own words (`applyReviewEdits`).
  let stepTemplate: { subject: string; content: JSONContent } | null = null;
  if (typeof stored['templateId'] === 'string') {
    stepTemplate = await loadTemplateParts(supabase, stored['templateId']);
    if (!stepTemplate) {
      // The send stops on this too ("email template not found"), so the
      // preview says so instead of guessing at a body.
      return { kind: 'other', summary: 'The saved template this email uses could not be found.' };
    }
  }
  const config = (edits ? applyReviewEdits(step.config, edits, stepTemplate) : stored) as Record<string, unknown>;

  // An edit detaches the step from its template, so the edited config may
  // name none: then the template's words are already in it.
  const template = typeof config['templateId'] === 'string' ? stepTemplate : null;
  // The send attaches the template's own files; the envelope lists them.
  const templateFiles =
    typeof config['templateId'] === 'string'
      ? await templateFileIds(supabase, config['templateId'], ctx.userId)
      : [];

  const preview = renderEmailPreview(config, template, ctx);
  if (edits) {
    // Re-rendered per debounced edit: only what an edit can change is
    // re-read, the rest of the envelope stays the saved step's (M5).
    try {
      const envelopePatch = await buildEnvelopePatch({
        supabase,
        config,
        templateFileIds: templateFiles,
        unresolved: preview.unresolved ?? [],
        unknown: preview.unknown ?? [],
        unresolvedHolds: preview.unresolvedHolds ?? false,
      });
      return { ...preview, envelopePatch };
    } catch (err) {
      console.error('[workflows] step envelope patch failed', step.id, err);
      return preview;
    }
  }
  try {
    const envelope = await buildSendEnvelope({
      supabase,
      step,
      ctx,
      config,
      templateFileIds: templateFiles,
      unresolved: preview.unresolved ?? [],
      unknown: preview.unknown ?? [],
      unresolvedHolds: preview.unresolvedHolds ?? false,
    });
    return { ...preview, envelope };
  } catch (err) {
    // Every read in the envelope already degrades on its own; this is the
    // last guard. The message is still worth showing without its envelope,
    // and a guessed envelope would be worse than none.
    console.error('[workflows] step envelope failed', step.id, err);
    return preview;
  }
}

/**
 * Render a `send_email` config for the MC to read, through the send's
 * own chain.
 *
 * Shared by the step review ({@link buildStepPreview}) and the builder's
 * Compose email modal, which previews an unsaved draft against a couple.
 * Pure: the caller has already loaded and ownership-checked `template`.
 *
 * @param config - A `send_email` config (a step's, or a composer draft)
 * @param template - The saved template it names, loaded; null for none
 * @param ctx - The run context to render against
 */
export function renderEmailPreview(
  config: Record<string, unknown>,
  template: { subject: string; content: JSONContent } | null,
  ctx: RunContext,
): StepPreview {
  const source = selectSendEmailSource(
    {
      subject: typeof config['subject'] === 'string' ? config['subject'] : undefined,
      content: isRecord(config['content']) ? config['content'] : undefined,
      body: typeof config['body'] === 'string' ? config['body'] : undefined,
    },
    template,
  );
  // `wrap` defaults to true in the action's schema; only an explicit
  // false turns the shell off. `highlightMissing` marks each unfilled
  // variable for the MC; it changes nothing when every variable fills,
  // and the send never passes it.
  const rendered = renderSendEmail(source, ctx, config['wrap'] !== false, { highlightMissing: true });
  // Every `send_email` is commercial, so the preview renders the copy
  // the couple gets: with the footer's unsubscribe link, as a placeholder.
  const html = recipientCopyHtml(rendered, ctx, PREVIEW_UNSUBSCRIBE_URL);

  // A gap Zebri cannot name is reported apart from a detail the couple is
  // missing: the advice for each is different (live check B7).
  const known = rendered.missing.filter((path) => isKnownVariable(path));
  const unknown = rendered.missing.filter((path) => !isKnownVariable(path));

  return {
    kind: 'email',
    summary: 'Send an email',
    subject: rendered.subject,
    ...(rendered.missing.length > 0
      ? { subjectPreview: renderEmailSubject(source.subject, ctx, 'preview') }
      : {}),
    source:
      source.kind === 'doc'
        ? { subject: source.subject, content: source.content, legacyText: false }
        : { subject: source.subject, content: textToDoc(source.body) as JSONContent, legacyText: true },
    html,
    fromTemplate: template !== null,
    ...(known.length > 0 ? { unresolved: known.map(variableLabel) } : {}),
    ...(unknown.length > 0 ? { unknown } : {}),
    ...(rendered.missing.length > 0 ? { unresolvedHolds: rendered.blocked } : {}),
  };
}

/** A plain object, as a stored TipTap doc is. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Apply an MC's edits to a step's `send_email` config.
 *
 * Editing at review time writes onto the step, never onto the saved
 * template: the MC is fixing this one send for this one couple, not
 * rewriting the wording for everybody.
 *
 * Per field (live check B2). A field the MC did not change is left
 * exactly as stored: a subject edit keeps the body's doc byte for byte,
 * and a body edit is the editor's own TipTap doc, so bold, lists, links,
 * the signature and every `{{variable}}` survive, and an unfilled one
 * still holds the send. Nothing here flattens a doc to paragraphs.
 *
 * A template-backed step is detached on any edit, because the send
 * prefers a template over the step's own words: the template's subject
 * and body are copied onto the step first, then the edit is laid over
 * them, so a subject edit still sends the template's body.
 *
 * @param config - The step's stored config.
 * @param edits - Only the fields the MC changed.
 * @param template - The saved template the config names, already loaded
 *   through the MC's own client; null when it names none.
 * @returns The config approving would leave on the step. With no edits,
 *   the config unchanged.
 */
export function applyReviewEdits(
  config: Json,
  edits: ReviewEdits,
  template: { subject: string; content: JSONContent } | null,
): Json {
  if (edits.subject === undefined && edits.content === undefined) return config;
  const next = { ...((config ?? {}) as Record<string, unknown>) };

  if (typeof next['templateId'] === 'string' && template) {
    delete next['templateId'];
    // A stale legacy body beside the copied words could be picked instead.
    delete next['body'];
    next['subject'] = template.subject;
    next['content'] = template.content;
  }
  if (edits.subject !== undefined) next['subject'] = edits.subject;
  if (edits.content !== undefined) {
    next['content'] = edits.content;
    // The send reads `content` before the legacy plain `body`; leaving the
    // old text beside it would only be dead weight that looks live.
    delete next['body'];
    // A template the caller could not load: the edited doc is the body now.
    delete next['templateId'];
  }
  return next as Json;
}

/**
 * {@link applyReviewEdits} for a server action: loads the saved template
 * a template-backed step names, through the MC's own client, first.
 *
 * @returns The config to write, or null when the step names a template
 *   that cannot be read (deleted, or not the MC's), which the send would
 *   stop on too.
 */
export async function applyReviewEditsFor(
  supabase: SupabaseClient<Database>,
  config: Json,
  edits: ReviewEdits,
): Promise<Json | null> {
  const stored = (config ?? {}) as Record<string, unknown>;
  const templateId = stored['templateId'];
  if (typeof templateId !== 'string') return applyReviewEdits(config, edits, null);
  const template = await loadTemplateParts(supabase, templateId);
  if (!template && edits.content === undefined) return null;
  return applyReviewEdits(config, edits, template);
}
