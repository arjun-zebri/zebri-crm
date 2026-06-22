/**
 * Guards the client-safe `actionUi` catalogue against drift from the
 * server `actionRegistry`.
 *
 * Client components read action display metadata from
 * `lib/automations/actions/ui` (no handler imports, so the server-only
 * handlers + their node deps never reach the browser). The handlers'
 * `ui` blocks remain the canonical source; this test fails if the two
 * ever disagree, so a label/icon change in a handler can't silently leave
 * the picker stale.
 */
import { describe, expect, it } from 'vitest';

import { actionRegistry } from '@/lib/automations/actions';
import { actionUi } from '@/lib/automations/actions/ui';

describe('actionUi catalogue parity', () => {
  it('covers exactly the registry action types with identical ui', () => {
    const registryUi = Object.fromEntries(
      Object.entries(actionRegistry).map(([type, spec]) => [type, spec!.ui]),
    );
    expect(actionUi).toEqual(registryUi);
  });
});
