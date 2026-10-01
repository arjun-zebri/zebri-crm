'use client';

import { useEffect, useState } from 'react';

/**
 * True from the `lg` breakpoint, where the builder's step panel sits
 * beside the story; below it the panel opens as a full-screen dialog.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/use-wide
 */
export function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}
