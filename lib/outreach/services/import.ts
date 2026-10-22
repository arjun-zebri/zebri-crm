/**
 * Persist an imported celebrant sheet: insert new prospects, fill blanks
 * on existing ones, and log both on the timeline.
 *
 * @module lib/outreach/services/import
 */
import { randomBytes } from 'node:crypto';

import type { Json } from '@/types/database';

import { mergeFill, mergeKey, planMerge, type ProspectInput } from '../import/sheet';
import type { AdminDb, ProspectInsert } from '../types';

import { recordEvents, type EventInput } from './events';
import { matchesSuppressed, suppressedValues } from './suppression';

const PAGE = 1000;
const INSERT_CHUNK = 500;
const REF_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** An 8-char attribution code without look-alike characters. */
export function newRefCode(): string {
  const bytes = randomBytes(8);
  return [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

/** Outcome reported back to the import wizard. */
export interface ImportOutcome {
  inserted: number;
  merged: number;
  unchanged: number;
}

type ExistingRow = { id: string; do_not_contact?: unknown } & Partial<Record<keyof ProspectInput, unknown>>;

const EXISTING_COLUMNS =
  'id, registration_no, dedupe_key, first_name, last_name, state, suburb, postcode, email, phone, website, instagram_handle, facebook_url, sheet_notes, sheet_status, do_not_contact';

/** Every existing prospect's merge key and fillable fields, paged. */
async function loadExisting(db: AdminDb): Promise<Map<string, ExistingRow>> {
  const out = new Map<string, ExistingRow>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('outreach_prospects').select(EXISTING_COLUMNS).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`load prospects: ${error.message}`);
    for (const row of data ?? []) {
      out.set(mergeKey({ registration_no: row.registration_no, dedupe_key: row.dedupe_key }), row as ExistingRow);
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Insert/merge prospects built by `buildProspects`. */
export async function importProspects(db: AdminDb, prospects: ProspectInput[]): Promise<ImportOutcome> {
  const existing = await loadExisting(db);
  const plan = planMerge(prospects, new Map([...existing].map(([k, v]) => [k, v.id])));
  const events: EventInput[] = [];
  // Why: someone who said stop stays blocked even under a new row, so the incoming row is flagged
  // do-not-contact at the door rather than relying on the send check alone. A bounced address
  // alone does not do this: it rules out that email, not the person.
  const suppressed = await suppressedValues(db, prospects.map((p) => p.email), prospects.map((p) => p.instagram_handle), { includeBounced: false });

  for (let i = 0; i < plan.inserts.length; i += INSERT_CHUNK) {
    const chunk = plan.inserts.slice(i, i + INSERT_CHUNK);
    // Every row carries the same keys: PostgREST bulk inserts silently
    // misbehave when rows differ in shape.
    const rows: ProspectInsert[] = chunk.map((p) => ({
      registration_no: p.registration_no,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      state: p.state,
      suburb: p.suburb,
      postcode: p.postcode,
      email: p.email,
      email_source: p.email ? 'sheet' : null,
      phone: p.phone,
      website: p.website,
      website_source: p.website ? 'sheet' : null,
      instagram_handle: p.instagram_handle,
      instagram_source: p.instagram_handle ? 'sheet' : null,
      facebook_url: p.facebook_url,
      sheet_notes: p.sheet_notes,
      sheet_status: p.sheet_status,
      sheet_raw: p.sheet_raw as Json,
      dedupe_key: p.dedupe_key,
      ref_code: newRefCode(),
      do_not_contact: matchesSuppressed(suppressed, p),
    }));
    const { data, error } = await db.from('outreach_prospects').insert(rows).select('id');
    if (error) throw new Error(`insert prospects: ${error.message}`);
    for (const r of data ?? []) events.push({ prospectId: r.id, type: 'imported', actor: 'admin' });
  }

  let merged = 0;
  let unchanged = 0;
  for (const { existingId, input } of plan.updates) {
    const current = existing.get(mergeKey(input))!;
    const patch = mergeFill(current, input);
    const keys = Object.keys(patch);
    const blockNow = matchesSuppressed(suppressed, input) && current.do_not_contact !== true;
    if (keys.length === 0 && !blockNow) {
      unchanged++;
      continue;
    }
    const sources: Record<string, string> = {};
    if ('email' in patch) sources.email_source = 'sheet';
    if ('website' in patch) sources.website_source = 'sheet';
    if ('instagram_handle' in patch) sources.instagram_source = 'sheet';
    const flag = blockNow ? { do_not_contact: true } : {};
    const { error } = await db
      .from('outreach_prospects')
      .update({ ...patch, ...sources, ...flag, updated_at: new Date().toISOString() })
      .eq('id', existingId);
    if (error) throw new Error(`merge prospect: ${error.message}`);
    merged++;
    events.push({ prospectId: existingId, type: 'merged', actor: 'admin', payload: { fields: [...keys, ...Object.keys(flag)] } });
  }

  for (let i = 0; i < events.length; i += PAGE) await recordEvents(db, events.slice(i, i + PAGE));
  return { inserted: plan.inserts.length, merged, unchanged };
}

/** What an import would do, for the wizard's preview step. */
export interface ImportPreview {
  newCount: number;
  mergeCount: number;
}

/** Count inserts vs merges without writing anything. */
export async function previewImport(db: AdminDb, prospects: ProspectInput[]): Promise<ImportPreview> {
  const existing = await loadExisting(db);
  const plan = planMerge(prospects, new Map([...existing].map(([k, v]) => [k, v.id])));
  return { newCount: plan.inserts.length, mergeCount: plan.updates.length };
}
