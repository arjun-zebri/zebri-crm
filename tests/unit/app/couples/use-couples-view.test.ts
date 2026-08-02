import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCouplesView } from '@/app/(dashboard)/couples/use-couples-view';
import type { Couple } from '@/types/couple';

/**
 * `Couple` types `name` and `email` as `string`, but both columns are
 * nullable: a couple added with only a name arrives with `email: null`.
 * The cast keeps the fixture honest about the runtime shape.
 */
function couple(partial: Partial<Couple> & { id: string }): Couple {
  return {
    name: 'Sarah & Tom',
    email: 'sarah@example.com',
    status: 'new',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  } as Couple;
}

describe('useCouplesView search', () => {
  it('searches a couple that has no email instead of throwing', () => {
    const couples = [
      couple({ id: 'a', name: 'Sarah & Tom', email: null as unknown as string }),
      couple({ id: 'b', name: 'Ana & Rob', email: 'ana@example.com' }),
    ];
    const { result } = renderHook(() => useCouplesView(couples));

    act(() => result.current.setSearch('sarah'));

    expect(result.current.filteredCouples.map((c) => c.id)).toEqual(['a']);
  });

  it('searches a couple that has no name', () => {
    const couples = [
      couple({ id: 'a', name: null as unknown as string, email: 'x@example.com' }),
      couple({ id: 'b', name: 'Ana & Rob', email: 'ana@example.com' }),
    ];
    const { result } = renderHook(() => useCouplesView(couples));

    act(() => result.current.setSearch('ana'));

    expect(result.current.filteredCouples.map((c) => c.id)).toEqual(['b']);
  });

  it('still matches on email', () => {
    const couples = [
      couple({ id: 'a', name: 'Sarah & Tom', email: 'unique@example.com' }),
      couple({ id: 'b', name: 'Ana & Rob', email: 'ana@example.com' }),
    ];
    const { result } = renderHook(() => useCouplesView(couples));

    act(() => result.current.setSearch('unique@'));

    expect(result.current.filteredCouples.map((c) => c.id)).toEqual(['a']);
  });
});
