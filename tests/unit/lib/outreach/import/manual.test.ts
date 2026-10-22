/**
 * A hand-added prospect is normalised with the same rules as a sheet row,
 * and a field typed in but unusable is an error rather than dropped.
 */
import { describe, expect, it } from 'vitest';

import { buildManualProspect } from '@/lib/outreach/import/manual';

describe('buildManualProspect', () => {
  it('normalises every field the way the sheet import does', () => {
    const r = buildManualProspect({
      full_name: '  Rev JANE   SMITH ', state: 'new south wales', suburb: ' Bondi ',
      email: 'Jane@Example.COM', instagram: 'https://instagram.com/Jane.Celebrant/', website: 'www.janesmith.com.au/?utm_source=x',
      phone: ' 0400 000 000 ',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prospect).toMatchObject({
      full_name: 'Rev JANE SMITH', first_name: 'Jane', last_name: 'Smith', state: 'NSW', suburb: 'Bondi',
      email: 'jane@example.com', instagram_handle: 'jane.celebrant', website: 'https://www.janesmith.com.au',
      phone: '0400 000 000', registration_no: null, dedupe_key: 'rev jane smith|bondi',
    });
  });

  it('needs only a name', () => {
    const r = buildManualProspect({ full_name: 'Jane Smith' });
    expect(r.ok).toBe(true);
  });

  it('says which fields to fix', () => {
    const r = buildManualProspect({ full_name: ' ', email: 'jane@', instagram: 'instagram.com/p/abc', website: 'facebook.com/jane' });
    expect(r).toEqual({
      ok: false,
      errors: {
        full_name: 'Enter their name.',
        email: 'That email address does not look right.',
        instagram: 'Enter an Instagram handle or profile link.',
        website: 'Enter a website address, not a social link.',
      },
    });
  });
});
