/**
 * Unit tests for `lib/payments/connect-events` — schema parsing for
 * the three Connect event types the platform webhook dispatches.
 *
 * The handler-side logic (Stripe API calls, DB writes) is covered by
 * the integration tests under `tests/integration/connect/`. These
 * unit tests pin the schemas + the parser's dispatch behaviour.
 */
import { describe, expect, it } from 'vitest';

import {
  HANDLED_CONNECT_EVENT_TYPES,
  parseConnectEvent,
} from '@/lib/payments/connect-events';

describe('parseConnectEvent', () => {
  describe('account.updated', () => {
    it('parses a fully-onboarded account snapshot', () => {
      const result = parseConnectEvent('account.updated', {
        id: 'acct_1Q',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        default_currency: 'aud',
        country: 'AU',
        business_type: 'individual',
        requirements: {
          currently_due: [],
          past_due: [],
          disabled_reason: null,
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'account.updated') {
        expect(result.event.data.charges_enabled).toBe(true);
        expect(result.event.data.country).toBe('AU');
      }
    });

    it('accepts a partial snapshot (Stripe may omit fields)', () => {
      const result = parseConnectEvent('account.updated', {
        id: 'acct_1Q',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts a disabled account with a list of requirements', () => {
      const result = parseConnectEvent('account.updated', {
        id: 'acct_1Q',
        charges_enabled: false,
        requirements: {
          currently_due: ['individual.dob.day', 'individual.dob.month'],
          past_due: ['external_account'],
          disabled_reason: 'requirements.past_due',
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'account.updated') {
        expect(result.event.data.requirements?.past_due).toEqual([
          'external_account',
        ]);
        expect(result.event.data.requirements?.disabled_reason).toBe(
          'requirements.past_due',
        );
      }
    });

    it('rejects a payload missing the account id', () => {
      const result = parseConnectEvent('account.updated', {
        charges_enabled: true,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('capability.updated', () => {
    it('parses a capability event with the parent account id', () => {
      const result = parseConnectEvent('capability.updated', {
        id: 'card_payments',
        account: 'acct_1Q',
        status: 'active',
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'capability.updated') {
        expect(result.event.data.account).toBe('acct_1Q');
      }
    });

    it('rejects when the parent account id is missing', () => {
      const result = parseConnectEvent('capability.updated', {
        id: 'card_payments',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('account.application.deauthorized', () => {
    it('parses with only the id', () => {
      const result = parseConnectEvent('account.application.deauthorized', {
        id: 'acct_1Q',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('unknown event types', () => {
    it('returns ok=false with the unhandled_event_type code', () => {
      const result = parseConnectEvent('balance.available', { id: 'b_1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0]?.code).toBe('unhandled_event_type');
      }
    });
  });

  it('HANDLED_CONNECT_EVENT_TYPES lists exactly the three handled types', () => {
    expect([...HANDLED_CONNECT_EVENT_TYPES].sort()).toEqual(
      [
        'account.application.deauthorized',
        'account.updated',
        'capability.updated',
      ].sort(),
    );
  });
});
