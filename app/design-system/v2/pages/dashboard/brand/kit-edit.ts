import { newId, type TextRole } from '../canvas/model';

import { kitHexOf, type BrandKit, type KitColour, type KitTextStyle } from './kit';
import { trimImage } from './trim-image';

/**
 * Changes to a brand kit, each returning a new kit: logos, colours and
 * palettes, text styles, house style and brand photos. The five colours
 * every kit starts with (brand, accent, ink, muted, paper) can be
 * recoloured and renamed but never removed: documents point at them by
 * id, and a heading pointing at a colour that is gone would turn black.
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit-edit
 */

/** The colours documents are built on, which stay in the kit. */
export const CORE_COLOURS: readonly string[] = ['primary', 'accent', 'ink', 'muted', 'paper'];

const mapColours = (kit: BrandKit, fn: (c: KitColour) => KitColour): BrandKit => ({
  ...kit,
  palettes: kit.palettes.map((p) => ({ ...p, colours: p.colours.map(fn) })),
});

/** Sets logo `id`'s picture (null removes it). */
export const setLogo = (kit: BrandKit, id: string, src: string | null): BrandKit => ({
  ...kit,
  logos: kit.logos.map((l) => (l.id === id ? { ...l, src } : l)),
});

/** Changes a colour's hex or name. */
export const setColour = (kit: BrandKit, id: string, patch: Partial<Omit<KitColour, 'id'>>): BrandKit =>
  mapColours(kit, (c) => (c.id === id ? { ...c, ...patch } : c));

/** Adds a colour to a palette, a copy of its last one to start from. */
export function addColour(kit: BrandKit, palette: string): BrandKit {
  return {
    ...kit,
    palettes: kit.palettes.map((p) =>
      p.id === palette ? { ...p, colours: [...p.colours, { id: newId('c'), name: 'New colour', hex: p.colours.at(-1)?.hex ?? kitHexOf(kit, 'muted') }] } : p,
    ),
  };
}

/** Removes a colour, unless documents are built on it. */
export const removeColour = (kit: BrandKit, id: string): BrandKit =>
  CORE_COLOURS.includes(id) ? kit : { ...kit, palettes: kit.palettes.map((p) => ({ ...p, colours: p.colours.filter((c) => c.id !== id) })) };

/** Adds an empty palette ("Spring weddings"), ready to fill. */
export const addPalette = (kit: BrandKit): BrandKit => ({
  ...kit,
  palettes: [...kit.palettes, { id: newId('p'), name: 'New palette', colours: [{ id: newId('c'), name: 'New colour', hex: '#c9b79c' }] }],
});

/** Renames a palette. */
export const renamePalette = (kit: BrandKit, id: string, name: string): BrandKit => ({
  ...kit,
  palettes: kit.palettes.map((p) => (p.id === id ? { ...p, name } : p)),
});

/** Removes a palette, unless it holds colours documents are built on. */
export const removePalette = (kit: BrandKit, id: string): BrandKit => ({
  ...kit,
  palettes: kit.palettes.filter((p) => p.id !== id || p.colours.some((c) => CORE_COLOURS.includes(c.id))),
});

/** Changes one text style. */
export const setTextStyle = (kit: BrandKit, role: TextRole, patch: Partial<KitTextStyle>): BrandKit => ({
  ...kit,
  text: { ...kit.text, [role]: { ...kit.text[role], ...patch } },
});

/** Changes the house style (corners, buttons). */
export const setHouse = (kit: BrandKit, patch: Partial<BrandKit['house']>): BrandKit => ({ ...kit, house: { ...kit.house, ...patch } });

/** Adds a brand photo. */
export const addAsset = (kit: BrandKit, name: string, src: string): BrandKit => ({ ...kit, assets: [...kit.assets, { id: newId('a'), name, src }] });

/** Removes a brand photo. */
export const removeAsset = (kit: BrandKit, id: string): BrandKit => ({ ...kit, assets: kit.assets.filter((a) => a.id !== id) });

/** Reads a picked image as a data URL, which survives the reload a saved account allows. */
export function readImage(file: File, done: (src: string) => void) {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' && done(reader.result);
  reader.readAsDataURL(file);
}

/** A logo `file` as a data URL with its empty margin trimmed (`trim-image.ts`), so its box hugs the logo. */
export function readLogo(file: File, done: (src: string) => void) {
  readImage(file, (src) => trimImage(src, done));
}
