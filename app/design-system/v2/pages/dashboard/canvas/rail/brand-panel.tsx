'use client';


import { AddTile } from '@/components/ui-v2/add-tile';
import { Button } from '@/components/ui-v2/button';
import { PaletteIcon } from '@/components/ui-v2/icons';
import { SwatchPicker } from '@/components/ui-v2/swatch-picker';

import { openYourLook } from '../../brand/your-look-store';
import { useCanvasData } from '../canvas-context';
import { refOf, worn } from '../look';
import { colorOf } from '../resolve';

import type { RailApi } from './api';
import { putPicture } from './picture';
import { logoOf } from './presets';

/**
 * The Brand tab: the kit at hand while designing. Logos to add, the kit's
 * palettes (a colour lands on whatever is picked: a text's colour, a
 * shape's fill, or the pages' background with nothing picked) and its
 * photos (into the picked frame, or onto the page). Edit opens the brand
 * kit itself.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/brand-panel
 */

/** The Brand tab. */
export function BrandPanel({ api }: { api: RailApi }) {
  const { kit, business } = useCanvasData();
  const { style, canvas } = api;
  const first = style.picked[0];
  const current = first ? ('look' in first ? worn(first.look, kit).color : first.box?.fill) : canvas.doc.pages[0]?.background;
  const apply = (hex: string) => {
    const ref = refOf(hex, kit);
    if (style.texts.length) style.text({ color: ref });
    else if (style.picked.length) style.box({ fill: ref });
    else canvas.pageStyle({ background: ref });
  };
  const logos = kit.logos.filter((l) => l.src || l.id === 'main');
  return (
    <div className="space-y-6">
      <section aria-label="Logos" className="space-y-2">
        <h3 className="type-label text-zebra-950">Logos</h3>
        <div className="grid grid-cols-2 gap-2">
          {logos.map((l) => (
            <AddTile key={l.id} label={`Add your ${l.name.toLowerCase()} logo`} onAdd={() => api.add(logoOf(l.id))} {...api.drag(() => logoOf(l.id))}>
              {l.src ? (
                // The MC's own logo, often a data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.src} alt="" className="max-h-12 max-w-[80%] object-contain" />
              ) : (
                <span className="max-w-full truncate px-2 type-body text-zebra-950">{business}</span>
              )}
            </AddTile>
          ))}
        </div>
      </section>
      <section aria-label="Colours" className="space-y-4">
        {kit.palettes.map((p) => (
          <SwatchPicker key={p.id} label={p.name} swatches={p.colours.map((c) => ({ value: c.hex, name: c.name }))} value={colorOf(current, kit) ?? ''} onChange={apply} />
        ))}
      </section>
      {kit.assets.length ? (
        <section aria-label="Photos" className="space-y-2">
          <h3 className="type-label text-zebra-950">Photos</h3>
          <div className="grid grid-cols-2 gap-2">
            {kit.assets.map((a) => (
              <AddTile key={a.id} label={`Add ${a.name}`} onAdd={() => putPicture(api, a.src)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt="" className="size-full object-cover" />
              </AddTile>
            ))}
          </div>
        </section>
      ) : null}
      <Button variant="secondary" icon={<PaletteIcon aria-hidden="true" className="size-4" />} onClick={openYourLook}>
        Edit global styling
      </Button>
    </div>
  );
}
