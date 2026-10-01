import { PALETTE, bestText, type PaletteFamily, type PaletteStep } from './palette';
import { Spec } from './showroom-v2';

/**
 * v2 colour foundations: the Zebra, Sky and Grass scales, then the
 * status colours (danger, warning and its ink and muted partners).
 *
 * Every swatch renders with its real token utility, so what you see is
 * what `app/globals.css` resolves to. The ratio on each swatch is the
 * WCAG contrast of the Zebra end (bone or ink) that reads best on it.
 *
 * @module app/design-system/v2/foundations-colour
 */
export function FoundationsColourV2() {
  return (
    <Spec
      name="Colour"
      file="app/globals.css"
      description="Three scales, 50 to 950. Zebra carries the neutrals, Sky is the accent, Grass is confirmation. The number on each swatch is its contrast with the text shown: 4.5 and up passes AA for body copy, 3 and up for large text and icons."
    >
      <div className="space-y-10">
        {PALETTE.map((family) => (
          <FamilyScale key={family.token} family={family} />
        ))}
        <StatusColours />
      </div>
    </Spec>
  );
}

/**
 * The status colours v2 uses beside the palette scales: red for money or
 * time gone wrong, amber for what needs a look. Amber-500 reads neither
 * as text nor as a big fill, so it has an ink (text) and a muted (large
 * fill) partner.
 */
const STATUS = [
  { bg: 'bg-danger', token: 'danger', use: 'Overdue, errors, a destructive action' },
  { bg: 'bg-danger/70', token: 'danger/70', use: 'Overdue in a chart beside grass (full red fails the colour-blind check)' },
  { bg: 'bg-warning', token: 'warning', use: 'Dots and small marks: due soon, waiting' },
  { bg: 'bg-warning-muted', token: 'warning-muted', use: 'A large amber fill, like the waterfall’s picked-out bar' },
  { bg: 'bg-warning-ink', token: 'warning-ink', use: 'Amber words and figures on white' },
] as const;

/** The status swatches, each with its token and what it is for. */
function StatusColours() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="type-label text-zebra-950">Status</p>
        <code className="type-code text-zebra-400">bg-warning-ink</code>
      </div>
      <p className="type-body text-zebra-500">Red and amber, for what has gone wrong or needs a look. Never decoration.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS.map((c) => (
          <div key={c.token} className="min-w-0">
            <div className={`h-20 rounded-button ${c.bg}`} />
            <p className="mt-1.5 type-label text-zebra-950">{c.token}</p>
            <p className="type-body text-zebra-500">{c.use}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One family: its name, token prefix, role and the full scale. */
function FamilyScale({ family }: { family: PaletteFamily }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="type-label text-zebra-950">{family.name}</p>
        <code className="type-code text-zebra-400">bg-{family.token}-500</code>
      </div>
      <p className="type-body text-zebra-500">{family.role}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11 lg:gap-1">
        {family.steps.map((s) => (
          <Swatch key={s.step} swatch={s} />
        ))}
      </div>
    </div>
  );
}

/** A single step: the live colour with a contrast sample, then its step and hex. */
function Swatch({ swatch }: { swatch: PaletteStep }) {
  const { onDark, ratio } = bestText(swatch.hex);
  return (
    <div className="min-w-0">
      <div
        className={`flex h-20 items-end rounded-button p-2 ${swatch.bg} ${
          onDark ? 'text-zebra-50' : 'text-zebra-950'
        } ${swatch.step === 50 ? 'border border-zebra-200' : ''}`}
      >
        <span className="type-label">Aa {ratio.toFixed(1)}</span>
      </div>
      <p className="mt-1.5 type-label text-zebra-950">{swatch.step}</p>
      <p className="type-code text-zebra-400">{swatch.hex}</p>
    </div>
  );
}
