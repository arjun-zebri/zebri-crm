import { describe, expect, it } from 'vitest';

import { leadNotificationHtml } from '@/lib/email/html';

describe('leadNotificationHtml', () => {
  it('includes the lead fields and escapes HTML', () => {
    const html = leadNotificationHtml({
      mcBusinessName: 'Curzon MCs',
      lead: {
        name: 'Jamie <script>',
        partnerName: 'Sam',
        email: 'jamie@example.test',
        phone: '+61 400',
        weddingDate: '2027-05-01',
        venue: 'Curzon Hall',
        referralSource: 'Instagram',
        message: 'Hello there',
      },
    });
    expect(html).toContain('jamie@example.test');
    expect(html).toContain('Curzon Hall');
    expect(html).toContain('Instagram');
    expect(html).not.toContain('<script>'); // escaped
  });

  it('omits rows for absent optional fields', () => {
    const html = leadNotificationHtml({
      mcBusinessName: 'Curzon MCs',
      lead: { name: 'Jamie', email: 'jamie@example.test' },
    });
    expect(html).toContain('jamie@example.test');
    expect(html).not.toContain('Heard via');
  });
});
