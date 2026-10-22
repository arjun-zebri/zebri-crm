/**
 * Add one prospect by hand, from the "Add prospect" form.
 *
 * The person lands exactly where an imported one would: unchecked, at
 * the New stage, picked up by the next activity check and then by any
 * campaign whose audience they fit. Contacts they typed are marked
 * "Added by you" rather than "From sheet".
 *
 * Refuses a duplicate (same name and suburb, or same email) with a
 * message naming who is already there, rather than creating a second
 * record that would get the same emails twice.
 *
 * @module lib/outreach/services/add-prospect
 */
import type { ProspectInput } from '../import/sheet';
import type { AdminDb } from '../types';

import { OutreachUserError } from './admin-ops';
import { recordEvent } from './events';
import { newRefCode } from './import';
import { isSuppressed } from './suppression';

/** Unique-violation code from Postgres. */
const UNIQUE_VIOLATION = '23505';

/** Who is already there, as "Jane Smith (Bondi)". */
function describe(p: { full_name: string; suburb: string | null }): string {
  return p.suburb ? `${p.full_name} (${p.suburb})` : p.full_name;
}

/** Throw a user error when this person is already a prospect. */
async function assertNew(db: AdminDb, prospect: ProspectInput): Promise<void> {
  const { data: byKey } = await db
    .from('outreach_prospects').select('full_name, suburb')
    .eq('dedupe_key', prospect.dedupe_key).is('registration_no', null).limit(1);
  if (byKey?.[0]) throw new OutreachUserError(`${describe(byKey[0])} is already a prospect.`);
  if (!prospect.email) return;
  const { data: byEmail } = await db
    .from('outreach_prospects').select('full_name, suburb').eq('email', prospect.email).limit(1);
  if (byEmail?.[0]) throw new OutreachUserError(`${describe(byEmail[0])} already uses that email.`);
}

/** Insert one hand-entered prospect and return its id. */
export async function addProspect(db: AdminDb, prospect: ProspectInput, notes: string | null): Promise<{ id: string }> {
  await assertNew(db, prospect);
  // Why: a person on the global opt-out list can be typed in again by hand; flag them at the door.
  const doNotContact = await isSuppressed(db, { email: prospect.email, instagram_handle: prospect.instagram_handle }, { includeBounced: false });
  const { data, error } = await db
    .from('outreach_prospects')
    .insert({
      registration_no: null,
      full_name: prospect.full_name,
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      state: prospect.state,
      suburb: prospect.suburb,
      postcode: null,
      email: prospect.email,
      email_source: prospect.email ? 'manual' : null,
      phone: prospect.phone,
      website: prospect.website,
      website_source: prospect.website ? 'manual' : null,
      instagram_handle: prospect.instagram_handle,
      instagram_source: prospect.instagram_handle ? 'manual' : null,
      notes,
      sheet_raw: {},
      dedupe_key: prospect.dedupe_key,
      ref_code: newRefCode(),
      do_not_contact: doNotContact,
    })
    .select('id')
    .single();
  // Two saves racing past the duplicate check land here.
  if (error?.code === UNIQUE_VIOLATION) throw new OutreachUserError(`${describe(prospect)} is already a prospect.`);
  if (error || !data) throw new Error(`add prospect: ${error?.message ?? 'no row'}`);
  await recordEvent(db, { prospectId: data.id, type: 'imported', actor: 'admin', payload: { source: 'manual' } });
  return { id: data.id };
}
