/**
 * The v2 type scale: every text element in the UI and its size.
 *
 * Each `cls` is a `type-*` role from `app/globals.css` (plus a colour
 * where the element has one). Class strings are full literals so
 * Tailwind emits them.
 *
 * @module app/design-system/v2/type-scale
 */

/** One UI text element and the style it uses. */
export interface TypeElement {
  /** What the element is. */
  name: string;
  /** Classes that render it. */
  cls: string;
  /** Size, weight and face, as shown on the page. */
  spec: string;
  /** Specimen text. */
  sample: string;
}

/** Every text element, largest first. */
export const TYPE_SCALE: TypeElement[] = [
  { name: 'Hero', cls: 'type-hero text-zebra-950', spec: 'type-hero · 64px · Medium', sample: 'Now one.' },
  { name: 'Display', cls: 'type-display text-zebra-950', spec: 'type-display · 33px · Semibold', sample: 'Sophie & James' },
  { name: 'Page title', cls: 'type-title text-zebra-950', spec: 'type-title · 28px · Semibold', sample: 'Couples' },
  { name: 'Heading', cls: 'type-heading text-zebra-950', spec: 'type-heading · 19px · Semibold', sample: 'Upcoming weddings' },
  { name: 'Subheading', cls: 'type-subheading text-zebra-950', spec: 'type-subheading · 16px · Semibold', sample: 'Ceremony details' },
  { name: 'Lead', cls: 'type-lead text-zebra-700', spec: 'type-lead · 16px · Regular', sample: 'Minute-by-minute timings the whole team can see.' },
  { name: 'Eyebrow', cls: 'type-eyebrow text-zebra-500', spec: 'type-eyebrow · 13px · Medium · Caps', sample: 'A proposal for' },
  { name: 'Body', cls: 'type-body text-zebra-950', spec: 'type-body · 13px · Regular', sample: 'The ceremony starts at 3:30pm.' },
  { name: 'Label', cls: 'type-label text-zebra-950', spec: 'type-label · 13px · Medium', sample: 'Venue address' },
  { name: 'Button', cls: 'type-label text-zebra-950', spec: 'type-label · 13px · Medium', sample: 'Send proposal' },
  { name: 'Input', cls: 'type-body text-zebra-950', spec: 'type-body · 13px · Regular', sample: 'Stones of the Yarra Valley' },
  { name: 'Link', cls: 'type-label text-zebra-950 underline underline-offset-2', spec: 'type-label · 13px · Medium', sample: 'View invoice' },
  { name: 'Helper text', cls: 'type-body text-zebra-500', spec: 'type-body · zebra-500', sample: 'Shown to the couple.' },
  { name: 'Group label', cls: 'type-body text-zebra-400', spec: 'type-body · zebra-400', sample: 'Get paid' },
  { name: 'Amount', cls: 'type-numeric text-zebra-950', spec: 'type-numeric · 13px · Medium · Tabular', sample: '$4,250.00' },
  { name: 'Code', cls: 'type-code text-zebra-700', spec: 'type-code · 12px · Mono', sample: 'components/ui-v2/button.tsx' },
];
