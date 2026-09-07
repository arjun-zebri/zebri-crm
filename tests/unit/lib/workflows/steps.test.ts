import { describe, expect, it } from 'vitest';

import { getStepSpec, isAutomated, stepRegistry } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

describe('step registry', () => {
  it('covers every StepType', () => {
    const expected: StepType[] = ['todo', 'action', 'wait', 'branch', 'appointment'];
    expect(Object.keys(stepRegistry).sort()).toEqual([...expected].sort());
  });

  it('each entry declares its own type as the key', () => {
    for (const [key, spec] of Object.entries(stepRegistry)) {
      expect(spec.type).toBe(key);
    }
  });

  it('to-do and appointment are manual, the rest are automated', () => {
    // This split is the whole feature: manual steps sit in `pending`
    // until the MC ticks them, which is what gates the automated steps
    // anchored after them.
    expect(isAutomated('todo')).toBe(false);
    expect(isAutomated('appointment')).toBe(false);
    expect(isAutomated('action')).toBe(true);
    expect(isAutomated('wait')).toBe(true);
    expect(isAutomated('branch')).toBe(true);
  });

  it('an unknown type is not automated and has no spec', () => {
    expect(getStepSpec('nonsense')).toBeNull();
    expect(isAutomated('nonsense')).toBe(false);
  });
});
