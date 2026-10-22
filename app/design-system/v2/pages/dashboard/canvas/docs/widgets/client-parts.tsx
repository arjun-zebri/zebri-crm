'use client';

import type { DemoPackage } from '../../../../onboarding/packages';
import { buttonRadiusOf, kitHexOf } from '../../../brand/kit';
import { money } from '../../../payments/payments-data';
import type { Question } from '../../../questionnaires/questionnaire-data';
import { useCanvasData } from '../../canvas-context';
import { colorOf } from '../../resolve';
import { kitStyle, KitText, useRule } from '../kit-text';

/**
 * The parts a couple acts on, drawn in the kit: the packages to choose
 * between, the one button that moves them on (Accept, Pay deposit, Fill
 * in my answers), in the brand kit's button style, and a questionnaire's
 * questions. On the couple's page these are live; here they are drawn as
 * they will look.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/widgets/client-parts
 */

/** The button, in the kit's house style (solid, outline or pill, its corners, the brand colour). */
export function CtaButton({ label, size }: { label: string; size: { w: number; h: number } }) {
  const { kit } = useCanvasData();
  const brand = kitHexOf(kit, 'primary');
  const solid = kit.house.button !== 'outline';
  return (
    // The kit's button: runtime colour, corners and face, set inline.
    <div
      style={{
        ...kitStyle(kit, 'body'),
        fontWeight: 600,
        height: size.h,
        background: solid ? brand : 'transparent',
        color: solid ? '#ffffff' : brand,
        boxShadow: solid ? undefined : `inset 0 0 0 1.5px ${brand}`,
        borderRadius: buttonRadiusOf(kit),
      }}
      className="flex w-full items-center justify-center"
    >
      {label}
    </div>
  );
}

/** The packages, side by side, the chosen one ringed in the brand colour. */
export function Packages({ packages, chosen }: { packages: DemoPackage[]; chosen?: string | undefined }) {
  const { kit } = useCanvasData();
  const faint = useRule();
  const brand = colorOf('kit:primary', kit);
  return (
    <div className="grid w-full auto-cols-fr grid-flow-col gap-4">
      {packages.map((p) => (
        <div
          key={p.name}
          // Ringed in the brand colour when chosen, a faint ink line otherwise: runtime colours.
          style={{ boxShadow: `inset 0 0 0 ${p.name === chosen ? 2 : 1}px ${p.name === chosen ? brand : faint}`, borderRadius: kit.house.radius }}
          className="space-y-3 p-5"
        >
          <KitText role="caption" tone="brand">{p.name}</KitText>
          <KitText role="subheading">{money(p.price)}</KitText>
          <ul className="space-y-1">
            {p.lines.slice(0, 4).map((l) => (
              <li key={l}>
                <KitText tone="muted">{l}</KitText>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A questionnaire's questions, each with the space its answer takes. */
export function Questions({ questions }: { questions: Question[] }) {
  const line = useRule(0.25);
  return (
    <ol className="w-full space-y-7">
      {questions.map((q, n) => (
        <li key={q.id} className="space-y-2">
          <KitText strong>
            {n + 1}. {q.label}
            {q.required ? ' *' : ''}
          </KitText>
          {q.help ? <KitText tone="muted">{q.help}</KitText> : null}
          {q.options.length ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <span key={o} style={{ boxShadow: `inset 0 0 0 1px ${line}` }} className="rounded-pill px-3 py-1">
                  <KitText as="span">{o}</KitText>
                </span>
              ))}
            </div>
          ) : (
            // The answer's line, in the kit's ink.
            <div style={{ borderBottom: `1px solid ${line}` }} className="h-8" />
          )}
        </li>
      ))}
    </ol>
  );
}
