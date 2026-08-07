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

/** Colour token swatches. */
export function FoundationsColour() {
  return (
    <>
      <Spec
        name="Colour"
        file="app/globals.css"
        description="Never use a raw Tailwind colour. Tailwind 4 shifted its grays, so text-gray-900 and text-text are not the same value."
      >
        <div className="space-y-6">
          <SwatchRow title="Surfaces" items={SURFACES} bordered />
          <SwatchRow title="Semantic" items={SEMANTIC} />
          <div className="space-y-2">
            <p className="text-body font-medium text-text-subtle">Text</p>
            <div className="flex flex-wrap gap-6">
              {TEXTS.map((t) => (
                <div key={t.name}>
                  <p className={`text-body font-medium ${t.cls}`}>The quick brown fox</p>
                  <p className="text-body text-text-subtle">
                    {t.name} · {t.hex}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Spec>

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
      <p className="text-body font-medium text-text-subtle">{title}</p>
      <div className="flex flex-wrap gap-4">
        {items.map((s) => (
          <div key={s.name} className="w-40">
            <div
              className={`h-12 rounded-control ${s.cls} ${bordered ? 'border border-border' : ''}`}
            />
            <p className="mt-1 text-body font-medium text-text">{s.name}</p>
            <p className="text-body text-text-subtle">{s.hex}</p>
            <p className="text-body text-text-subtle">{s.use}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
