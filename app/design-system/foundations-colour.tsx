import { Conflict, TOP_PALETTE } from './conflict';
import { Spec } from './showroom';

/**
 * Colour foundations: the semantic palette and its raw-Tailwind rival.
 *
 * Swatches render with the real token utility, so these are the values
 * `app/globals.css` resolves to today rather than documented intent.
 *
 * @module app/design-system/foundations-colour
 */

const SURFACES = [
  { cls: 'bg-surface', name: 'surface', hex: '#ffffff', use: 'Primary panel background' },
  { cls: 'bg-surface-muted', name: 'surface-muted', hex: '#fafafa', use: 'Card background' },
  { cls: 'bg-surface-emphasis', name: 'surface-emphasis', hex: '#f3f4f6', use: 'Hover / selected row' },
  { cls: 'bg-card', name: 'card', hex: '#ffffff', use: 'Popover / floating surface' },
];

const TEXTS = [
  { cls: 'text-text', name: 'text', hex: '#111827', use: 'Body text' },
  { cls: 'text-text-muted', name: 'text-muted', hex: '#6b7280', use: 'Secondary text' },
  { cls: 'text-text-subtle', name: 'text-subtle', hex: '#9ca3af', use: 'Placeholder / meta' },
];

const SEMANTIC = [
  { cls: 'bg-brand-fg', name: 'brand-fg', hex: '#000000', use: 'Primary CTA / mark' },
  { cls: 'bg-success', name: 'success', hex: '#059669', use: 'Success / paid' },
  { cls: 'bg-danger', name: 'danger', hex: '#dc2626', use: 'Destructive / error' },
  { cls: 'bg-warning', name: 'warning', hex: '#f59e0b', use: 'Caution' },
  { cls: 'bg-info', name: 'info', hex: '#2563eb', use: 'Informational' },
];

/** Colour token swatches plus the raw-palette conflict. */
export function FoundationsColour() {
  return (
    <>
      <Spec
        name="Colour"
        file="app/globals.css"
        description="Semantic tokens. The hex shown is the current resolved value."
      >
        <div className="space-y-6">
          <SwatchRow title="Surfaces" items={SURFACES} bordered />
          <SwatchRow title="Semantic" items={SEMANTIC} />
          <div className="space-y-2">
            <p className="text-caption font-medium text-text-subtle">Text</p>
            <div className="flex flex-wrap gap-6">
              {TEXTS.map((t) => (
                <div key={t.name}>
                  <p className={`text-body font-medium ${t.cls}`}>The quick brown fox</p>
                  <p className="text-caption text-text-subtle">
                    {t.name} · {t.hex}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Spec>

      <Conflict
        title="Mostly resolved: the four bulk aliases are swept"
        group="colour"
        recommendation={
          <>
            1,735 sites moved onto tokens: <code>text-gray-900</code>, <code>text-gray-500</code>,{' '}
            <code>text-gray-400</code>, <code>border-gray-200</code>, <code>border-gray-300</code>,{' '}
            <code>bg-white</code> and <code>bg-gray-100</code>. Worth knowing: Tailwind 4 shifted its
            gray palette, so <code>text-gray-900</code> was rendering <code>#101828</code> while the
            token is <code>#111827</code>. The app had two gray palettes side by side; the sweep
            removes that. The three text swaps shift by 1 to 3 of 255, which is imperceptible but not
            literally identical.
            <br />
            What is left has no exact token: <code>gray-600</code>, <code>gray-700</code>,{' '}
            <code>gray-50</code> and the semantic hues used by <code>Badge</code>. Public branded
            surfaces are excluded by design.
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {TOP_PALETTE.map((p) => (
            <span
              key={p.label}
              className="rounded-pill border border-border bg-surface px-2 py-0.5 text-caption text-text-muted"
            >
              <code>{p.label}</code>{' '}
              <span className="tabular-nums text-text-subtle">{p.count}</span>
            </span>
          ))}
        </div>
      </Conflict>
    </>
  );
}

/** A labelled row of colour chips. */
function SwatchRow({
  title,
  items,
  bordered = false,
}: {
  title: string;
  items: { cls: string; name: string; hex: string; use: string }[];
  bordered?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-caption font-medium text-text-subtle">{title}</p>
      <div className="flex flex-wrap gap-4">
        {items.map((s) => (
          <div key={s.name} className="w-40">
            <div
              className={`h-12 rounded-control ${s.cls} ${bordered ? 'border border-border' : ''}`}
            />
            <p className="mt-1 text-caption font-medium text-text">{s.name}</p>
            <p className="text-caption text-text-subtle">{s.hex}</p>
            <p className="text-caption text-text-subtle">{s.use}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
