import { describe, expect, it } from 'vitest';

import { formatSlackMessage } from '@/lib/alerts/send-alert';

describe('lead_blocked_plan_limit alert', () => {
  it('formats a Slack message with the MC email', () => {
    const payload = formatSlackMessage({
      type: 'lead_blocked_plan_limit',
      severity: 'warn',
      userId: 'u-123',
      email: 'mc@example.test',
    });
    expect(payload.text).toContain('lead blocked plan limit');
    expect(payload.text).toContain('mc@example.test');
  });
});
