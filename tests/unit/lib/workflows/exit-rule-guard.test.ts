/**
 * The save-time exit-rule check fails closed: when it cannot read the
 * workflow it is checking, it refuses the save rather than skipping the
 * check (Task 21 fix round 1, M4).
 */
import { describe, expect, it } from 'vitest';

import { exitRuleRefusal } from '@/lib/workflows/exit-rule-guard';

/** A client whose every read resolves to `result`. */
function client(result: { data: unknown; error: { message: string } | null }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return { from: () => q } as never;
}

const RULE = { applyRuleType: 'manual', applyRuleConfig: {} };

describe('exitRuleRefusal', () => {
  it('refuses when the workflow cannot be read', async () => {
    const refusal = await exitRuleRefusal(
      client({ data: null, error: { message: 'connection reset' } }),
      'tpl',
      RULE,
    );
    expect(typeof refusal).toBe('string');
    expect(refusal).toMatch(/could not check/i);
  });

  it('reports not found when the read succeeds with no row', async () => {
    expect(await exitRuleRefusal(client({ data: null, error: null }), 'tpl', RULE)).toEqual({
      notFound: true,
    });
  });

  it('allows a save with no conflict', async () => {
    const row = { apply_rule_type: 'manual', apply_rule_config: {}, exit_statuses: ['lost'] };
    expect(await exitRuleRefusal(client({ data: row, error: null }), 'tpl', RULE)).toBeNull();
  });
});
