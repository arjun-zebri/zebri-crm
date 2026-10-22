'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CropIcon, ImageUpIcon, MaximizeIcon, SlidersIcon, SquareIcon } from '@/components/ui-v2/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Segmented } from '@/components/ui-v2/segmented';
import { Slider } from '@/components/ui-v2/slider';
import { SwatchPicker } from '@/components/ui-v2/swatch-picker';

import { kitColours, kitHexOf } from '../../brand/kit';
import { Dot } from '../../doc-builder/editor/section-bar/bar-parts';
import { Tool } from '../../scripts/script-tools';
import { ICON } from '../icon-props';
import { refOf } from '../look';
import type { BoxLook, CanvasElement } from '../model';
import { colorOf } from '../resolve';
import type { Canvas } from '../use-canvas';


import { ColourTool } from './colour-tool';
import type { Style } from './use-style';

/**
 * The box half of the toolbar: fill and outline for shapes (and a
 * background behind text), a new picture and its fit for images, and a
 * "Look" card for corners, shadow, transparency and inner space. Mixed
 * picks get only what they share (transparency).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/box-tools
 */

const SHADOWS = ['none', 'soft', 'lifted'] as const;
type ShadowName = (typeof SHADOWS)[number];

export interface BoxToolsProps {
  style: Style;
  canvas: Canvas;
  used: string[];
}

/** The box tools. See {@link BoxToolsProps}. */
export function BoxTools({ style, canvas, used }: BoxToolsProps) {
  const file = useRef<HTMLInputElement>(null);
  const first = style.picked[0];
  if (!first) return null;
  const kind = style.picked.every((el) => el.kind === first.kind) ? first.kind : null;
  const box: BoxLook = first.box ?? {};
  const shape = first.kind === 'shape' ? first.shape : null;
  const filled = kind === 'shape' || kind === 'text';
  const outlined = kind === 'shape' && shape !== 'line';
  const cornered = (kind === 'shape' && shape === 'rect') || kind === 'image' || kind === 'text';
  const set = (patch: BoxLook, live = false) => style.box(patch, live);
  const image = kind === 'image' && first.kind === 'image' ? first : null;
  const pickImage = (f: File | undefined) => {
    if (!f || !image) return;
    const reader = new FileReader();
    reader.onload = () => canvas.update([image.id], { src: String(reader.result) } as Partial<CanvasElement>);
    reader.readAsDataURL(f);
  };
  return (
    <>
      {filled ? (
        <ColourTool
          label={kind === 'text' ? 'Background' : 'Fill'}
          value={box.fill}
          kit={style.kit}
          used={used}
          onChange={(fill) => set({ fill })}
          onClear={() => set({ fill: null })}
          glyph={(hex) => <Dot colour={hex ?? null} />}
        />
      ) : null}
      {outlined ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" square aria-label="Outline">
              <SquareIcon {...ICON} />
            </Button>
          </PopoverTrigger>
          <PopoverContent size="card" align="start" className="space-y-4">
            <SwatchPicker
              label="Outline"
              swatches={kitColours(style.kit).map((c) => ({ value: c.hex, name: c.name }))}
              value={colorOf(box.stroke, style.kit) ?? kitHexOf(style.kit, 'ink')}
              onChange={(hex) => set({ stroke: refOf(hex, style.kit), strokeWidth: box.strokeWidth ?? 2 })}
            />
            <Slider label="Thickness" min={0} max={24} value={box.stroke ? (box.strokeWidth ?? 1) : 0} onChange={(v) => set(v ? { strokeWidth: v, stroke: box.stroke ?? 'kit:ink' } : { stroke: null }, true)} onCommit={style.settle} format={(v) => `${v}px`} />
          </PopoverContent>
        </Popover>
      ) : null}
      {image ? (
        <>
          <Tool label="Replace picture" text="Replace" onClick={() => file.current?.click()}>
            <ImageUpIcon {...ICON} />
          </Tool>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
          <Tool label={image.fit === 'cover' ? 'Fit whole picture' : 'Fill the frame'} onClick={() => canvas.update([image.id], { fit: image.fit === 'cover' ? 'contain' : 'cover' } as Partial<CanvasElement>)}>
            {image.fit === 'cover' ? <MaximizeIcon {...ICON} /> : <CropIcon {...ICON} />}
          </Tool>
        </>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" square aria-label="Look" tooltip="Corners, shadow, transparency">
            <SlidersIcon {...ICON} />
          </Button>
        </PopoverTrigger>
        <PopoverContent size="card" align="start" className="space-y-4">
          {cornered ? <Slider label="Corners" min={0} max={80} value={box.radius ?? 0} onChange={(v) => set({ radius: v }, true)} onCommit={style.settle} format={(v) => `${v}px`} /> : null}
          {kind && kind !== 'text' ? (
            <div className="space-y-1.5">
              <p className="type-label text-zebra-950">Shadow</p>
              <Segmented<ShadowName> label="Shadow" options={SHADOWS} value={box.shadow ?? 'none'} onChange={(shadow) => set({ shadow })} labels={{ none: 'None', soft: 'Soft', lifted: 'Lifted' }} />
            </div>
          ) : null}
          {kind === 'text' ? <Slider label="Inner space" min={0} max={48} value={box.padding ?? 0} onChange={(v) => set({ padding: v }, true)} onCommit={style.settle} format={(v) => `${v}px`} /> : null}
          <Slider label="Transparency" min={0} max={100} value={Math.round((1 - (box.opacity ?? 1)) * 100)} onChange={(v) => set({ opacity: 1 - v / 100 }, true)} onCommit={style.settle} format={(v) => `${v}%`} />
        </PopoverContent>
      </Popover>
    </>
  );
}
