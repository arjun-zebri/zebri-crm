import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AUTOMATED_STEP_TYPES } from '@/lib/workflows/steps';

const migrations = path.resolve(__dirname, '../../../supabase/migrations');

/** The body of the newest migration that defines automations_tick_due(). */
function latestTickDueSql(): string {
  const file = readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .find((f) =>
      readFileSync(path.join(migrations, f), 'utf8').includes(
        'create function public.automations_tick_due(',
      ),
    );
  if (!file) throw new Error('no migration defines automations_tick_due()');
  return readFileSync(path.join(migrations, file), 'utf8');
}

describe('automations_tick_due() step types', () => {
  // Postgres decides whether to wake the app from its own copy of the list.
  // A new automated step type missing here would sit due until the
  // next quarter-hour call instead of running within five minutes.
  it('matches AUTOMATED_STEP_TYPES', () => {
    const match = latestTickDueSql().match(/s\.type in \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const sqlTypes = (match?.[1] ?? '').split(',').map((t) => t.trim().replace(/'/g, ''));
    expect([...sqlTypes].sort()).toEqual([...AUTOMATED_STEP_TYPES].sort());
  });
});
