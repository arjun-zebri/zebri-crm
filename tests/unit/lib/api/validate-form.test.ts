import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseFormData } from '@/lib/api/validate';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe('parseFormData', () => {
  it('returns ok with parsed data on valid input', () => {
    const r = parseFormData(fd({ email: 'a@b.com', password: 'longenough' }), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe('a@b.com');
  });

  it('returns failure with fieldErrors on invalid input', () => {
    const r = parseFormData(fd({ email: 'bad', password: 'short' }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.email).toBeDefined();
      expect(r.fieldErrors.password).toBeDefined();
      expect(r.error).toBeDefined();
    }
  });

  it('coerces empty strings to undefined so optional fields accept blank inputs', () => {
    const r = parseFormData(
      fd({ email: 'a@b.com', password: 'longenough', next: '' }),
      schema,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.next).toBeUndefined();
  });

  it('reports the first issue message as the top-level error', () => {
    const r = parseFormData(fd({ email: 'bad', password: 'short' }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });
});
