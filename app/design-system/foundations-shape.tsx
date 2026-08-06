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
        title="Resolved: the type scale is on tokens"
        group="typography"
        recommendation={
          <>
            1,186 sites swept: <code>text-sm</code> to <code>text-body</code>,{' '}
            <code>text-xs</code> to <code>text-caption</code>, <code>text-xl</code> to{' '}
            <code>text-section</code>, <code>text-3xl</code> to <code>text-display</code>.
            <br />
            The tokens previously set a font-size and nothing else, so they inherited their leading
            and rendered about 1px looser per line than the Tailwind classes they are documented as
            equalling. Each token now carries Tailwind&apos;s own line-height ratio, so the pairs are
            byte-identical and <code>leading-*</code> overrides still win. What is left is{' '}
            <code>text-2xl</code>, <code>text-lg</code> and <code>text-base</code>, which have no
            token.
          </>
        }
      />

      <Spec name="Radius" file="app/globals.css" description="Two tokens, deliberately.">
        <DemoGrid cols={2}>
          <Demo label="rounded-control · 6px · everything with corners">
            <div className="h-14 rounded-control border border-border bg-surface-muted" />
          </Demo>
          <Demo label="rounded-pill · 9999px · pills, chips, avatars, dots">
            <div className="h-14 rounded-pill border border-border bg-surface-muted" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="Resolved: six rendered radii collapsed to two"
        group="radius"
        recommendation={
          <>
            The app rendered 2px, 4px, 6px, 8px, 12px and 16px corners against a three-token
            system almost nobody followed. Everything with corners is now <code>rounded-control</code>{' '}
            (6px) and everything round is <code>rounded-pill</code>. The <code>--radius-card</code>{' '}
            (12px) and <code>rounded-2xl</code> (16px) tiers are gone, so cards and modals read
            flatter than before. That is the intended change.
            <br />
            Two arbitrary values survive on purpose: a 12px swatch at <code>rounded-[4px]</code> and
            a 2px progress segment, both of which 6px would turn into blobs. Public branded surfaces
            set <code>borderRadius</code> inline from each MC&apos;s brand kit and are not governed
            by these tokens.
          </>
        }
      >
        <DemoRow>
          {(
            [
              ['2px', 'rounded-[2px]'],
              ['4px', 'rounded-[4px]'],
              ['6px (token)', 'rounded-control'],
              ['8px', 'rounded-[8px]'],
              ['12px', 'rounded-[12px]'],
              ['16px', 'rounded-[16px]'],
            ] as const
          ).map(([label, cls]) => (
            <div key={label} className="space-y-1 text-center">
              <div className={`h-12 w-16 border border-border-strong bg-surface ${cls}`} />
              <code className="text-caption text-text-subtle">{label}</code>
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
            <div key={p} className={`rounded-control border border-border bg-surface ${p}`}>
              <div className="h-6 w-16 rounded-control bg-surface-emphasis" />
              <code className="mt-1 block text-center text-caption text-text-subtle">{p}</code>
            </div>
          ))}
        </DemoRow>
      </Conflict>
    </>
  );
}
