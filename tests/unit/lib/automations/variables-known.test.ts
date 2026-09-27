/**
 * Known and unknown variables (Phase 5 live check B7).
 *
 * `{{event.venue}}` is not a variable Zebri reads (the venue is
 * `{{venue.name}}`), so it can never be filled. It was reported as
 * "Venue could not be filled in ... add the detail to the couple",
 * advice that could never release the hold. These pin the split the
 * envelope and the compose preview word from.
 */
import { describe, expect, it } from 'vitest';

import { isKnownVariable, VARIABLE_CATALOGUE, variableLabel } from '@/lib/automations/variables';

describe('isKnownVariable', () => {
  it('knows every catalogue variable', () => {
    for (const group of VARIABLE_CATALOGUE) {
      for (const v of group.variables) {
        expect(isKnownVariable(v.token.replace(/[{}]/g, '')), v.token).toBe(true);
      }
    }
  });

  it('knows the aliases the resolver reads', () => {
    for (const path of ['couple.partner1', 'couple.full_name', 'event.days_since', 'mc.name', 'mc.phone']) {
      expect(isKnownVariable(path), path).toBe(true);
    }
  });

  it('knows any key in the namespaces read from the trigger and earlier steps', () => {
    for (const path of ['invoice.total', 'contract.link', 'task.due_date', 'questionnaire.id']) {
      expect(isKnownVariable(path), path).toBe(true);
    }
  });

  it('does not know event.venue, or a namespace it has never heard of', () => {
    expect(isKnownVariable('event.venue')).toBe(false);
    expect(isKnownVariable('venue.address')).toBe(false);
    expect(isKnownVariable('guest.name')).toBe(false);
  });

  it('ignores filters', () => {
    expect(isKnownVariable('event.date | friendly')).toBe(true);
    expect(isKnownVariable(' event.venue | upper ')).toBe(false);
  });
});

describe('variableLabel for an unknown variable', () => {
  it('shows the token as typed, not a guessed label', () => {
    // A guessed "Venue" read as a real detail the couple was missing.
    expect(variableLabel('event.venue')).toBe('{{event.venue}}');
  });

  it('still labels a known variable in words', () => {
    expect(variableLabel('venue.name')).toBe('Venue name');
  });
});
