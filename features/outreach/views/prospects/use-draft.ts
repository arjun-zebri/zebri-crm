'use client';

import { useState } from 'react';

/**
 * A local draft for one saved field. It follows the server value when
 * that value changes (a background check can fill a contact), but never
 * overwrites what the founder is typing in between.
 *
 * The state is adjusted during render rather than in an effect: that
 * avoids a frame where the stale draft shows, and it is React's
 * documented pattern for resetting state from a prop.
 *
 * @param server The value as the server has it right now.
 * @returns `[draft, setDraft]`, like `useState`.
 */
export function useDraft(server: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(server);
  const [seen, setSeen] = useState(server);
  if (server !== seen) {
    setSeen(server);
    setDraft(server);
  }
  return [draft, setDraft];
}
