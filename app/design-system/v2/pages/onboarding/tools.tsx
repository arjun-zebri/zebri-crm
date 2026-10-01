import type { IconType } from 'react-icons';
import { SiCalendly, SiCanva, SiDropbox, SiSpotify, SiXero } from 'react-icons/si';
import { TbBrandZoom } from 'react-icons/tb';

/**
 * The ten tools an MC, Celebrant or DJ juggles today: the cast of the
 * welcome cover's orbit.
 *
 * Marks come from Simple Icons (`react-icons/si`) in each brand's own
 * colour. Zoom's and Typeform's Simple Icons are wordmarks that turn to
 * mush at 24px, so Zoom uses Tabler's camera mark and Typeform a
 * lettermark. Qwilr, DocuSign and Celebrant Easy have no mark in the set,
 * so they get a plain lettermark rather than an imitation of their logos.
 *
 * @module app/design-system/v2/pages/onboarding/tools
 */

/** One tool: its name, mark and brand colour. */
export interface Tool {
  name: string;
  icon: IconType | null;
  color: string;
}

export const TOOLS: Tool[] = [
  { name: 'Calendly', icon: SiCalendly, color: '#006BFF' },
  { name: 'Celebrant Easy', icon: null, color: '#5a5a55' },
  { name: 'Zoom', icon: TbBrandZoom, color: '#0B5CFF' },
  { name: 'DocuSign', icon: null, color: '#5a5a55' },
  { name: 'Xero', icon: SiXero, color: '#13B5EA' },
  { name: 'Typeform', icon: null, color: '#262627' },
  { name: 'Canva', icon: SiCanva, color: '#00C4CC' },
  { name: 'Spotify', icon: SiSpotify, color: '#1DB954' },
  { name: 'Dropbox', icon: SiDropbox, color: '#0061FF' },
  { name: 'Qwilr', icon: null, color: '#5a5a55' },
];

/** A tool's mark at 24px, or its lettermark when it has none. */
export function ToolMark({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  if (!Icon)
    return (
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-zebra-500 type-label leading-none text-zebra-50">
        {tool.name[0]}
      </span>
    );
  // Brand colours are the brands' own, so they are the icon's `color`
  // prop rather than mapped to our tokens.
  return <Icon aria-hidden="true" color={tool.color} className="size-6 shrink-0" />;
}
