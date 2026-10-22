'use client';

import { Button } from '@/components/ui-v2/button';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, CaseUpperIcon, ExpandIcon, ItalicIcon, MinusIcon, PlusIcon, UnderlineIcon } from '@/components/ui-v2/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Slider } from '@/components/ui-v2/slider';

import { Tool } from '../../scripts/script-tools';
import { ICON } from '../icon-props';
import { worn } from '../look';
import type { TextRole } from '../model';

import { ColourTool, LetterA } from './colour-tool';
import { FaceMenu, RoleMenu } from './text-menus';
import type { Style } from './use-style';

/**
 * The text half of the toolbar, for the picked texts: style, face, size,
 * colour, bold / italic / underline / capitals, alignment (one button
 * that steps left, centre, right, as Canva's does) and spacing. What it
 * shows is the first picked text's look; a change goes where `Style`
 * sends it (this text, or every text of its style).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/text-tools
 */

const ALIGNS = [
  { value: 'left', icon: AlignLeftIcon, label: 'Align left' },
  { value: 'center', icon: AlignCenterIcon, label: 'Align centre' },
  { value: 'right', icon: AlignRightIcon, label: 'Align right' },
] as const;

/** Sizes step by one up to 24px, then by two, then by four past 48. */
const step = (size: number, dir: 1 | -1) => {
  const by = size + (dir === 1 ? 0 : -1) >= 48 ? 4 : size + (dir === 1 ? 0 : -1) >= 24 ? 2 : 1;
  return Math.min(200, Math.max(6, size + dir * by));
};

export interface TextToolsProps {
  style: Style;
  /** Colours already on the document. */
  used: string[];
  /** Hands the picked texts to another style, dropping their own face and size. */
  onRole: (role: TextRole) => void;
}

/** The text tools. See {@link TextToolsProps}. */
export function TextTools({ style, used, onRole }: TextToolsProps) {
  const first = style.texts[0];
  if (!first) return null;
  const w = worn(first.look, style.kit);
  const kitWeight = style.kit.text[w.role].weight;
  const bold = w.weight >= 600;
  const align = ALIGNS.findIndex((a) => a.value === w.align);
  const next = ALIGNS[(align + 1) % ALIGNS.length]!;
  const AlignIcon = ALIGNS[Math.max(0, align)]!.icon;
  return (
    <>
      <RoleMenu role={w.role} kit={style.kit} onRole={onRole} />
      <FaceMenu font={w.font} kit={style.kit} onFont={(font) => style.text({ font })} />
      <Tool label="Smaller" onClick={() => style.text({ size: step(w.size, -1) })}>
        <MinusIcon {...ICON} />
      </Tool>
      <span aria-label="Size" className="w-7 text-center type-numeric text-zebra-950">
        {Math.round(w.size)}
      </span>
      <Tool label="Larger" onClick={() => style.text({ size: step(w.size, 1) })}>
        <PlusIcon {...ICON} />
      </Tool>
      <ColourTool label="Text colour" value={w.color} kit={style.kit} used={used} onChange={(color) => style.text({ color })} glyph={(hex) => <LetterA hex={hex} />} />
      <Tool label="Bold" on={bold} onClick={() => style.text({ weight: bold ? (kitWeight < 600 ? kitWeight : 400) : 700 })}>
        <BoldIcon {...ICON} />
      </Tool>
      <Tool label="Italic" on={w.italic} onClick={() => style.text({ italic: !w.italic })}>
        <ItalicIcon {...ICON} />
      </Tool>
      <Tool label="Underline" on={w.underline} onClick={() => style.text({ underline: !w.underline })}>
        <UnderlineIcon {...ICON} />
      </Tool>
      <Tool label="Capitals" on={w.uppercase} onClick={() => style.text({ uppercase: !w.uppercase })}>
        <CaseUpperIcon {...ICON} />
      </Tool>
      <Tool label={next.label} onClick={() => style.text({ align: next.value })}>
        <AlignIcon {...ICON} />
      </Tool>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" square aria-label="Spacing">
            <ExpandIcon {...ICON} />
          </Button>
        </PopoverTrigger>
        <PopoverContent size="card" align="start" className="space-y-4">
          <Slider label="Letter spacing" min={-5} max={40} value={Math.round(w.letterSpacing * 100)} onChange={(v) => style.text({ letterSpacing: v / 100 }, true)} onCommit={style.settle} />
          <Slider label="Line spacing" min={80} max={240} step={5} value={Math.round(w.lineHeight * 100)} onChange={(v) => style.text({ lineHeight: v / 100 }, true)} onCommit={style.settle} format={(v) => (v / 100).toFixed(2)} />
        </PopoverContent>
      </Popover>
    </>
  );
}
