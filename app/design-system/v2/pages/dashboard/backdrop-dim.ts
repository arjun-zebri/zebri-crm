'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page deep in the dashboard shade the app backdrop (the
 * Backdrop's `dim`) while something of its own is open, such as the
 * workflow builder's step panel. The dashboard owns the flag; a page
 * only asks for it while it needs it.
 *
 * @module app/design-system/v2/pages/dashboard/backdrop-dim
 */

/** The dashboard's setter for the backdrop shade. A no-op outside it. */
export const BackdropDimContext = createContext<(on: boolean) => void>(() => {});

/** Shade the backdrop while `on`; lifts it again on unmount. */
export function useBackdropDim(on: boolean): void {
  const set = useContext(BackdropDimContext);
  useEffect(() => {
    set(on);
    return () => set(false);
  }, [on, set]);
}
