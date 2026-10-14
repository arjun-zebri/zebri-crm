/**
 * Adding a prospect by hand against the real schema: it lands like an
 * imported one with its contacts marked "manual", and a second add of the
 * same person (by name and suburb, or by email) is refused by name.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { buildManualProspect } from '@/lib/outreach/import/manual';
import { addProspect } from '@/lib/outreach/services/add-prospect';

import { serviceClient } from '../helpers/supabase';

const db = serviceClient();
const tag = `add-${Date.now()}`;
const created: string[] = [];

function built(input: Parameters<typeof buildManualProspect>[0]) {
  const r = buildManualProspect(input);
  if (!r.ok) throw new Error('fixture did not build');
  return r.prospect;
}

describe('addProspect', () => {
  afterAll(async () => {
    if (created.length) await db.from('outreach_prospects').delete().in('id', created);
  });

  it('inserts a new, unchecked prospect with manual sources and an "added" event', async () => {
    const { id } = await addProspect(db, built({ full_name: `Jane ${tag}`, suburb: 'Bondi', state: 'NSW', email: `${tag}@example.com`, instagram: '@jane_x' }), 'Met at a wedding');
    created.push(id);
    const { data: p } = await db.from('outreach_prospects').select('*').eq('id', id).single();
    expect(p).toMatchObject({
      verdict: 'unchecked', stage: 'new', state: 'NSW', notes: 'Met at a wedding',
      email_source: 'manual', instagram_source: 'manual', website_source: null,
    });
    expect(p!.ref_code).toHaveLength(8);
    const { data: events } = await db.from('outreach_events').select('type, actor, payload').eq('prospect_id', id);
    expect(events).toEqual([{ type: 'imported', actor: 'admin', payload: { source: 'manual' } }]);
  });

  it('refuses the same name in the same suburb', async () => {
    await expect(addProspect(db, built({ full_name: `Jane ${tag}`, suburb: 'Bondi' }), null))
      .rejects.toThrow(`Jane ${tag} (Bondi) is already a prospect.`);
  });

  it('refuses an email someone already has', async () => {
    await expect(addProspect(db, built({ full_name: `Someone Else ${tag}`, email: `${tag}@example.com` }), null))
      .rejects.toThrow(`Jane ${tag} (Bondi) already uses that email.`);
  });
});
