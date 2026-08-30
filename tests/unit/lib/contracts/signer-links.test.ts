import { describe, expect, it } from 'vitest';

import { NOT_SAVED_YET, NO_SECONDARY_CONTACT, pendingSignerLinks, signerLinks } from '@/lib/contracts/signer-links';

const origin = 'https://app.test';

describe('signerLinks', () => {
  it('gives each client contact their own link, vendor excluded', () => {
    const rows = signerLinks(
      [
        { role: 'client', name: 'Alex', sign_token: 'a' },
        { role: 'client', name: 'Sam', sign_token: 'b' },
        { role: 'vendor', name: 'Jo', sign_token: 'v' },
      ],
      origin,
    );
    expect(rows).toEqual([
      { label: 'Primary contact', name: 'Alex', url: `${origin}/contract/a` },
      { label: 'Secondary contact', name: 'Sam', url: `${origin}/contract/b` },
    ]);
  });

  it('keeps the secondary row, unavailable with a reason, when the couple has one partner', () => {
    const rows = signerLinks([{ role: 'client', name: 'Alex', sign_token: 'a' }], origin);
    expect(rows[1]).toEqual({
      label: 'Secondary contact',
      name: null,
      url: null,
      unavailableReason: NO_SECONDARY_CONTACT,
    });
  });

  it('names the contacts before the first save, with no links yet', () => {
    expect(pendingSignerLinks('Alex', 'Sam')).toEqual([
      { label: 'Primary contact', name: 'Alex', url: null, unavailableReason: NOT_SAVED_YET },
      { label: 'Secondary contact', name: 'Sam', url: null, unavailableReason: NOT_SAVED_YET },
    ]);
    expect(pendingSignerLinks('Alex', '')[1]?.unavailableReason).toBe(NO_SECONDARY_CONTACT);
  });
});
