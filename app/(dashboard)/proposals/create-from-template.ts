/**
 * Creating a proposal from a template (roadmap R3 §6.1, "Create").
 *
 * The MC designs a template; the couple must receive a copy of it. This
 * action is that copy: it snapshots the template's layout into
 * `proposals.layout` with fresh section ids, records which template it
 * came from, seeds the couple's choosable options from the layout's
 * packages section, and applies the template's (or the account's) expiry
 * and deposit defaults. Editing the template afterwards never reaches a
 * proposal already created from it.
 *
 * It lives in `app/` rather than `features/proposals/` because it needs
 * `./write-options`'s `replaceOptions`, and `features/` may not import
 * from `app/`.
 *
 * @module app/(dashboard)/proposals/create-from-template
 */
'use server';

import {
  cloneLayoutWithFreshIds, layoutPackageOptions, packageOptionsToInputs, parseProposalLayout, parseStoredSettings,
  resolveTemplateSettings, getProposalSettingsAction, type ProposalLayout, type ProposalSettingsSnapshot,
} from '@/features/proposals';
import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import { toPlainJSON } from '@/lib/utils';
import type { Json } from '@/types/database';

import { createProposalFromTemplateSchema } from './create-from-template-schema';
import { replaceOptions } from './write-options';

/** The RLS-scoped client every read and write below runs on. Never the service role. */
type Client = Awaited<ReturnType<typeof createClient>>;

/** A template resolved for copying: just the two pieces the create path reads. */
interface SourceTemplate { id: string; layout: ProposalLayout; settings: ProposalSettingsSnapshot | null }

/**
 * Create a draft proposal for a couple from one of the MC's templates.
 *
 * @param raw - Unvalidated `{ coupleId, templateId, expiresAt }`; see
 *   `createProposalFromTemplateSchema` for what each `null` means.
 * @returns The new proposal's id, or a short message safe to show the MC.
 */
export async function createProposalFromTemplateAction(
  raw: unknown,
): Promise<{ ok: true; proposalId: string } | { ok: false; error: string }> {
  const input = createProposalFromTemplateSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: 'Invalid proposal details.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const template = await loadTemplate(supabase, input.data.templateId, user.id);
    if ('error' in template) return { ok: false, error: template.error };

    // RLS is what proves the couple is this MC's: a foreign id simply
    // returns no row rather than a different error.
    const { data: couple } = await supabase
      .from('couples').select('id, name').eq('id', input.data.coupleId).maybeSingle();
    if (!couple) return { ok: false, error: 'Couple not found.' };

    const account = await getProposalSettingsAction();
    if (!account.ok) return { ok: false, error: account.error };
    const settings = resolveTemplateSettings(account.settings, template.settings);

    const { data: num, error: numErr } = await supabase.rpc('generate_proposal_number', { p_user_id: user.id });
    if (numErr) throw numErr;

    const { data: inserted, error: insErr } = await supabase
      .from('proposals')
      .insert({
        user_id: user.id,
        couple_id: couple.id,
        status: 'draft',
        proposal_number: num as string,
        title: `${couple.name}, your wedding`,
        template_id: template.id,
        // Fresh section ids: the proposal is a SNAPSHOT of the template,
        // so the two must never share the ids the editor keys selection,
        // history and `jump` buttons off. `toPlainJSON` because editor
        // attrs are null-prototype and a server action drops them.
        layout: toPlainJSON(cloneLayoutWithFreshIds(template.layout)) as unknown as Json,
        expires_at: input.data.expiresAt ?? inDays(settings.expiry_days),
        deposit_percent: settings.deposit_percent,
        contract_template_id: await defaultContractTemplateId(supabase),
      })
      .select('id')
      .single();
    if (insErr || !inserted) throw insErr ?? new Error('insert returned no row');

    // Zero packages is allowed: the MC can add cards in the editor, and a
    // proposal with no options is a perfectly good draft.
    await replaceOptions(supabase, inserted.id, user.id, packageOptionsToInputs(layoutPackageOptions(template.layout)));

    return { ok: true, proposalId: inserted.id };
  } catch (err) {
    logger.error('[proposals/create-from-template] createProposalFromTemplateAction failed', {
      userId: user.id,
      coupleId: input.data.coupleId,
      templateId: input.data.templateId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not create the proposal. Please try again.' };
  }
}

/**
 * The template to copy: the requested one, else the account default, else
 * the most recently updated. A stored layout the v2 schema rejects is a
 * failure rather than a silent fallback, because copying a layout the MC
 * cannot have designed would quietly send the couple the wrong document.
 */
async function loadTemplate(supabase: Client, templateId: string | null, userId: string): Promise<SourceTemplate | { error: string }> {
  const query = supabase.from('proposal_templates').select('id, layout, settings');
  const { data, error } = templateId
    ? await query.eq('id', templateId).maybeSingle()
    // `is_default` first, then freshest: exactly the order the templates
    // list itself shows, so "the default" means the same thing in both.
    : await query.order('is_default', { ascending: false }).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    logger.error('[proposals/create-from-template] template read failed', { userId, templateId, error: error.message });
    return { error: 'Could not load your proposal template.' };
  }
  if (!data) return { error: templateId ? 'Template not found.' : 'Create a proposal template first.' };
  const parsed = parseProposalLayout(data.layout);
  if (!parsed.ok) {
    logger.error('[proposals/create-from-template] template layout invalid', { userId, templateId: data.id, issues: parsed.issues.slice(0, 5) });
    return { error: 'That template cannot be opened. Open it in the editor and save it again.' };
  }
  return { id: data.id, layout: parsed.layout, settings: parseStoredSettings(data.settings) };
}

/** The contract the proposal's close should use: the MC's default template, else their first one, else none. */
async function defaultContractTemplateId(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from('contract_templates').select('id, is_default')
    .order('is_default', { ascending: false }).order('position', { ascending: true })
    .limit(1).maybeSingle();
  return data?.id ?? null;
}

/** Today plus `days`, as `YYYY-MM-DD`. UTC throughout so the date does not shift with the server's timezone. */
function inDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
