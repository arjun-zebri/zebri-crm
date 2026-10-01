/**
 * The v2 colour palette: zebras, blue sky and green grass, with
 * champagne kept for celebration.
 *
 * Each family is an 11-step scale declared in `app/globals.css` under
 * `@theme inline`. The class strings are written out in full because
 * Tailwind only emits utilities it can read as complete literals at
 * build time, so they cannot be built from `family` + `step`.
 *
 * @module app/design-system/v2/palette
 */

/** One step of a colour scale. */
export interface PaletteStep {
  /** Scale position, 50 (lightest) to 950 (darkest). */
  step: number;
  /** Value as declared in `app/globals.css`. */
  hex: string;
  /** The background utility that renders this step. */
  bg: string;
}

/** A named colour scale. */
export interface PaletteFamily {
  /** Tailwind token prefix, e.g. `zebra` for `bg-zebra-500`. */
  token: string;
  /** Display name. */
  name: string;
  /** What the scale is for, in a sentence. */
  role: string;
  steps: PaletteStep[];
}

/** The v2 families, in the order they render. */
export const PALETTE: PaletteFamily[] = [
  {
    token: 'zebra',
    name: 'Zebra',
    role: 'Neutrals, from bone white to stripe black. Surfaces, text and borders come from here.',
    steps: [
      { step: 50, hex: '#fafaf7', bg: 'bg-zebra-50' },
      { step: 100, hex: '#f2f2ee', bg: 'bg-zebra-100' },
      { step: 200, hex: '#e4e4df', bg: 'bg-zebra-200' },
      { step: 300, hex: '#cbcbc5', bg: 'bg-zebra-300' },
      { step: 400, hex: '#a3a39c', bg: 'bg-zebra-400' },
      { step: 500, hex: '#7a7a74', bg: 'bg-zebra-500' },
      { step: 600, hex: '#5a5a55', bg: 'bg-zebra-600' },
      { step: 700, hex: '#3e3e3b', bg: 'bg-zebra-700' },
      { step: 800, hex: '#262624', bg: 'bg-zebra-800' },
      { step: 900, hex: '#161615', bg: 'bg-zebra-900' },
      { step: 950, hex: '#0b0b0a', bg: 'bg-zebra-950' },
    ],
  },
  {
    token: 'azure',
    name: 'Sky',
    role: 'Clear daytime blue. The accent: links and focus.',
    steps: [
      { step: 50, hex: '#f0f8ff', bg: 'bg-azure-50' },
      { step: 100, hex: '#ddeffd', bg: 'bg-azure-100' },
      { step: 200, hex: '#bfe1fb', bg: 'bg-azure-200' },
      { step: 300, hex: '#92cdf7', bg: 'bg-azure-300' },
      { step: 400, hex: '#5db2f0', bg: 'bg-azure-400' },
      { step: 500, hex: '#3796e4', bg: 'bg-azure-500' },
      { step: 600, hex: '#1f72bf', bg: 'bg-azure-600' },
      { step: 700, hex: '#1e61a3', bg: 'bg-azure-700' },
      { step: 800, hex: '#1d5286', bg: 'bg-azure-800' },
      { step: 900, hex: '#1c446e', bg: 'bg-azure-900' },
      { step: 950, hex: '#132b48', bg: 'bg-azure-950' },
    ],
  },
  {
    token: 'grass',
    name: 'Grass',
    role: 'Fresh green. The primary action, plus confirmation: booked, paid, signed.',
    steps: [
      { step: 50, hex: '#f3faec', bg: 'bg-grass-50' },
      { step: 100, hex: '#e3f4d3', bg: 'bg-grass-100' },
      { step: 200, hex: '#c8e9ac', bg: 'bg-grass-200' },
      { step: 300, hex: '#a3d97a', bg: 'bg-grass-300' },
      { step: 400, hex: '#7fc54f', bg: 'bg-grass-400' },
      { step: 500, hex: '#5fa932', bg: 'bg-grass-500' },
      { step: 600, hex: '#488725', bg: 'bg-grass-600' },
      { step: 700, hex: '#386721', bg: 'bg-grass-700' },
      { step: 800, hex: '#2f521f', bg: 'bg-grass-800' },
      { step: 900, hex: '#28461d', bg: 'bg-grass-900' },
      { step: 950, hex: '#12260b', bg: 'bg-grass-950' },
    ],
  },
  {
    token: 'champagne',
    name: 'Champagne',
    role: 'Warm gold, for celebration only: the booking confetti beside grass. Never an action, a status or a surface.',
    steps: [
      { step: 50, hex: '#fbf8f1', bg: 'bg-champagne-50' },
      { step: 100, hex: '#f5eedc', bg: 'bg-champagne-100' },
      { step: 200, hex: '#ecdcb6', bg: 'bg-champagne-200' },
      { step: 300, hex: '#e0c68a', bg: 'bg-champagne-300' },
      { step: 400, hex: '#d4ae62', bg: 'bg-champagne-400' },
      { step: 500, hex: '#c49645', bg: 'bg-champagne-500' },
      { step: 600, hex: '#a87a36', bg: 'bg-champagne-600' },
      { step: 700, hex: '#876030', bg: 'bg-champagne-700' },
      { step: 800, hex: '#6e4e2c', bg: 'bg-champagne-800' },
      { step: 900, hex: '#5b4127', bg: 'bg-champagne-900' },
      { step: 950, hex: '#332213', bg: 'bg-champagne-950' },
    ],
  },
];

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** The palette's own light and dark ends, used as the text on a swatch. */
export const INK = '#0b0b0a';
export const BONE = '#fafaf7';

/**
 * Picks whichever end of the Zebra scale reads better on `hex`, and the
 * ratio it achieves. Using the palette's own ends rather than pure
 * black and white shows the contrast the real UI will get.
 */
export function bestText(hex: string): { onDark: boolean; ratio: number } {
  const onInk = contrastRatio(hex, INK);
  const onBone = contrastRatio(hex, BONE);
  return onBone >= onInk ? { onDark: true, ratio: onBone } : { onDark: false, ratio: onInk };
}
