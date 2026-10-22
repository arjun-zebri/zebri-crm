'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Which plan a visitor picked on the way to the waitlist form. A pricing
 * card's "Join with Max" scrolls to the one form on the page; this
 * carries the plan along with it, so the form can say "Joining with Max"
 * and the sign-up records it (2026-10-19 review: every plan button
 * landed on the same box and the choice was lost).
 *
 * The default is a no-op, so a page without the provider still works:
 * its plan buttons just carry nothing.
 *
 * @module app/design-system/v2/pages/website/waitlist-plan
 */

interface WaitlistPlan {
  /** The plan's name ("Max"), or null when none was picked. */
  plan: string | null;
  setPlan: (plan: string | null) => void;
}

const PlanContext = createContext<WaitlistPlan>({ plan: null, setPlan: () => {} });

/** Holds the picked plan for every waitlist button and form inside it. */
export function WaitlistPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<string | null>(null);
  const value = useMemo(() => ({ plan, setPlan }), [plan]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** The picked plan and its setter. */
export const useWaitlistPlan = () => useContext(PlanContext);
