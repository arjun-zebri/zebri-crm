import { Conflict } from './conflict';
import { Demo, DemoGrid, DemoRow, Spec } from './showroom';

/**
 * Shape foundations: type scale, corner radius, icon weight, padding.
 *
 * Every specimen renders with the class it names, so a conflict block is
 * a genuine visual comparison rather than a table of numbers.
 *
 * @module app/design-system/foundations-shape
 */

const TYPE_SCALE = [
  { cls: 'text-display font-semibold', name: 'text-display', size: '1.875rem', legacy: 'text-3xl' },
  { cls: 'text-section font-semibold', name: 'text-section', size: '1.25rem', legacy: 'text-xl' },
  { cls: 'text-body', name: 'text-body', size: '0.875rem', legacy: 'text-sm' },
  { cls: 'text-caption', name: 'text-caption', size: '0.75rem', legacy: 'text-xs' },
];

const RADII = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full'];
const STROKES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/** Typography, radius, icon-weight and padding specs plus their conflicts. */
export function FoundationsShape() {
  return (
    <>
      <Spec
        name="Typography"
        file="app/globals.css"
        description="Four semantic sizes. Each maps exactly onto one legacy Tailwind class."
      >
        <div className="space-y-4">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={`${t.cls} text-text`}>Wedding MC bookings</span>
              <code className="text-caption text-text-subtle">
                {t.name} · {t.size} · same as {t.legacy}
              </code>
            </div>
          ))}
        </div>
      </Spec>

      <Conflict
        title="text-display is never used; the raw Tailwind scale dominates"
        group="typography"
        recommendation={
          <>
            Token and legacy classes render identically today, so this is cosmetic. It matters
            because a future type-scale change would only reach a fifth of the app. Migrate the four
            raw classes to their token equivalents and keep raw ones out of new code.
          </>
        }
      >
        <DemoRow>
          <span className="text-3xl font-semibold text-text">Aa</span>
          <code className="text-caption text-text-subtle">text-3xl</code>
          <span className="ml-4 text-display font-semibold text-text">Aa</span>
          <code className="text-caption text-text-subtle">text-display</code>
        </DemoRow>
      </Conflict>

      <Spec name="Radius" file="app/globals.css" description="Three token radii.">
        <DemoGrid cols={3}>
          <Demo label="rounded-control · 6px · buttons, inputs">
            <div className="h-14 rounded-control border border-border bg-surface-muted" />
          </Demo>
          <Demo label="rounded-card · 12px · cards, panels">
            <div className="h-14 rounded-card border border-border bg-surface-muted" />
          </Demo>
          <Demo label="rounded-pill · 9999px · badges">
            <div className="h-14 rounded-pill border border-border bg-surface-muted" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="Six competing corner radii across the app"
        group="radius"
        recommendation={
          <>
            Standardise on the three tokens. <code>rounded-xl</code> (12px) already equals{' '}
            <code>rounded-card</code> and <code>rounded-md</code> (6px) equals{' '}
            <code>rounded-control</code>, so most of the debt is a pure rename with no visual change
            at all.
          </>
        }
      >
        <DemoRow>
          {RADII.map((cls) => (
            <div key={cls} className="space-y-1 text-center">
              <div className={`h-12 w-16 border border-border-strong bg-surface ${cls}`} />
              <code className="text-caption text-text-subtle">{cls}</code>
            </div>
          ))}
        </DemoRow>
      </Conflict>

      <Conflict
        title="Icon stroke width drifts off the mandated 1.5"
        group="icons"
        recommendation={
          <>
            CLAUDE.md mandates <code>strokeWidth={'{1.5}'}</code>. Off-spec icons read visibly
            heavier when they sit next to a compliant icon in the same row, which is the case in
            most toolbars.
          </>
        }
      >
        <DemoRow>
          {STROKES.map((w) => (
            <div key={w} className="space-y-1 text-center">
              <svg
                width={28}
                height={28}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={w}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={w === 1.5 ? 'text-success' : 'text-text-muted'}
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <code className="block text-caption text-text-subtle">{w}</code>
            </div>
          ))}
        </DemoRow>
      </Conflict>

      <Conflict
        title="Container padding has no canonical value"
        group="padding"
        recommendation={
          <>
            Pick two: <code>p-4</code> for compact cards and <code>p-6</code> for page-level panels.
            The current six-way spread is why cards on different pages never quite line up.
          </>
        }
      >
        <DemoRow>
          {['p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8'].map((p) => (
            <div key={p} className={`rounded-card border border-border bg-surface ${p}`}>
              <div className="h-6 w-16 rounded-control bg-surface-emphasis" />
              <code className="mt-1 block text-center text-caption text-text-subtle">{p}</code>
            </div>
          ))}
        </DemoRow>
      </Conflict>
    </>
  );
}
