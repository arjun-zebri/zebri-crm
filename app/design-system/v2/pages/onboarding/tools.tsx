import type { IconType } from 'react-icons';
import { SiCalendly, SiCanva, SiDropbox, SiSpotify, SiXero } from 'react-icons/si';
import { TbBrandZoom } from 'react-icons/tb';

/**
 * The ten tools an MC, Celebrant or DJ juggles today: the cast of the
 * welcome cover's orbit.
 *
 * Marks come from Simple Icons (`react-icons/si`) in each brand's own
 * colour. Zoom's Simple Icon is a wordmark that turns to mush at 24px, so
 * Zoom uses Tabler's camera mark. Celebrant Easy, DocuSign, Typeform and
 * Qwilr have no mark in any icon set, so they use their own marks, taken
 * from each company's site icon (2026-10-18) and kept in
 * `public/brands/`; Typeform's is redrawn as a clean SVG of its mark (a
 * short pill beside a rounded block) without the file's grey square.
 *
 * @module app/design-system/v2/pages/onboarding/tools
 */

/** One tool: its name, mark and brand colour. */
export interface Tool {
  name: string;
  icon: IconType | null;
  color: string;
  /** The brand's own mark as an image in `public/brands/`, for one no icon set has. */
  image?: string | undefined;
}

export const TOOLS: Tool[] = [
  { name: 'Calendly', icon: SiCalendly, color: '#006BFF' },
  { name: 'Celebrant Easy', icon: null, color: '#5a5a55', image: '/brands/celebrant-easy.webp' },
  { name: 'Zoom', icon: TbBrandZoom, color: '#0B5CFF' },
  { name: 'DocuSign', icon: null, color: '#5a5a55', image: '/brands/docusign.png' },
  { name: 'Xero', icon: SiXero, color: '#13B5EA' },
  { name: 'Typeform', icon: null, color: '#262627', image: '/brands/typeform.svg' },
  { name: 'Canva', icon: SiCanva, color: '#00C4CC' },
  { name: 'Spotify', icon: SiSpotify, color: '#1DB954' },
  { name: 'Dropbox', icon: SiDropbox, color: '#0061FF' },
  { name: 'Qwilr', icon: null, color: '#5a5a55', image: '/brands/qwilr.svg' },
];

/**
 * A tool's mark at 24px (20px when `small`): its icon, else its own
 * image (`image`), else its initial on a small tile as a last resort.
 */
export function ToolMark({ tool, small = false }: { tool: Tool; /** 20px, for a quiet strip of logos (the website hero's foot). */ small?: boolean }) {
  const Icon = tool.icon;
  const size = small ? 'size-5' : 'size-6';
  if (tool.image)
    // A plain img: a 20 to 24px mark needs no optimiser, and the brands' files are already that small.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tool.image} alt="" aria-hidden="true" className={`${size} shrink-0 object-contain`} />;
  if (!Icon)
    return (
      <span
        aria-hidden="true"
        className={`flex ${size} shrink-0 items-center justify-center ${small ? 'rounded-check' : 'rounded-pill'} bg-zebra-700 type-label leading-none text-zebra-50`}
      >
        {tool.name[0]}
      </span>
    );
  // Brand colours are the brands' own, so they are the icon's `color`
  // prop rather than mapped to our tokens.
  return <Icon aria-hidden="true" color={tool.color} className={`${size} shrink-0`} />;
}
