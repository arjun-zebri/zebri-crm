'use client';

import type { CSSProperties, ReactNode } from 'react';

import { useCanvasData } from '../canvas-context';
import type { ColorRef, TextRole } from '../model';
import { colorOf, textCss } from '../resolve';

/**
 * Words inside a working part (an invoice's line items, a contract's
 * clauses), set in the brand kit's text styles, so "All body text" in the
 * toolbar or a new body face in the brand kit reaches them too. `tone`
 * picks the kit colour: ink for what matters, muted for labels, brand for
 * accents.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/kit-text
 */

/** The kit colour each tone uses. */
const TONE: Record<'ink' | 'muted' | 'brand', ColorRef> = { ink: 'kit:ink', muted: 'kit:muted', brand: 'kit:primary' };

export interface KitTextProps {
  role?: TextRole | undefined;
  tone?: keyof typeof TONE | undefined;
  as?: 'p' | 'span' | 'div' | undefined;
  /** Heavier than the style's own weight: a label that leads (a clause's title). */
  strong?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** Kit-styled words. See {@link KitTextProps}. */
export function KitText({ role = 'body', tone = 'ink', as: Tag = 'p', strong = false, className, children }: KitTextProps) {
  const style = kitStyle(useCanvasData().kit, role, tone);
  return (
    // The kit's style, resolved at runtime.
    <Tag style={strong ? { ...style, fontWeight: 600 } : style} className={className}>
      {children}
    </Tag>
  );
}

/** The CSS for `role` in `tone`. */
export function kitStyle(kit: ReturnType<typeof useCanvasData>['kit'], role: TextRole, tone: keyof typeof TONE = 'ink'): CSSProperties {
  return { ...textCss({ role, color: TONE[tone] }, kit), textAlign: undefined };
}

/** A hairline in the kit's ink, faint: rules inside a working part. */
export function useRule(strength = 0.12) {
  const { kit } = useCanvasData();
  return `color-mix(in oklab, ${colorOf('kit:ink', kit)} ${Math.round(strength * 100)}%, transparent)`;
}
