'use client';

import { BAR_RULE, FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { Segmented } from '@/components/ui-v2/segmented';

import { ROLES } from '../../brand/kit';
import { Dot } from '../../doc-builder/editor/section-bar/bar-parts';
import type { CanvasDoc } from '../model';
import { RequiredBadge } from '../required-badge';
import { colorOf } from '../resolve';
import type { Canvas } from '../use-canvas';

import { ArrangeTools } from './arrange-tools';
import { BoxTools } from './box-tools';
import { ColourTool } from './colour-tool';
import { TextTools } from './text-tools';
import { useStyle, type Scope } from './use-style';

/**
 * The bar floating over the top of the desk, changing with what is
 * picked, as Canva's does: text tools for text, fill and look for shapes
 * and pictures, then position, duplicate and delete. For text it ends in
 * "This text / All headings": the second writes the brand kit, so every
 * heading in every document follows. With nothing picked it offers the
 * page background.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/context-toolbar
 */

const Gap = () => <span aria-hidden="true" className={BAR_RULE} />;

/** Every colour already on `doc`, as hexes, for "On this document". */
function usedColours(doc: CanvasDoc, kit: Parameters<typeof colorOf>[1]): string[] {
  const refs = doc.pages.flatMap((p) => [p.background, ...p.elements.flatMap((el) => [el.box?.fill, el.box?.stroke, 'look' in el ? el.look.color : undefined])]);
  return refs.map((r) => colorOf(r, kit)).filter((h): h is string => !!h && h.startsWith('#'));
}

/** The floating toolbar for `canvas`. */
export function ContextToolbar({ canvas }: { canvas: Canvas }) {
  const style = useStyle(canvas);
  const used = usedColours(canvas.doc, style.kit);
  const allLabel = ROLES.find((r) => r.role === style.role)?.all ?? 'All like it';
  const locked = style.picked.some((el) => el.locked);
  const page = canvas.doc.pages[0];
  return (
    <div role="toolbar" aria-label="Style" className={`absolute inset-x-0 top-3 z-10 mx-auto w-max max-w-[calc(100%-1.5rem)] overflow-x-auto [&>*]:shrink-0 ${FLOATING_BAR}`}>
      {style.picked.length === 0 && page ? (
        <ColourTool
          label="Page colour"
          value={page.background}
          kit={style.kit}
          used={used}
          onChange={(background) => canvas.pageStyle({ background })}
          glyph={(hex) => <Dot colour={hex ?? null} />}
        />
      ) : (
        <>
          {locked ? (
            <span className="px-1.5">
              <RequiredBadge />
            </span>
          ) : null}
          {style.texts.length ? (
            <TextTools
              style={style}
              used={used}
              onRole={(role) => canvas.update(style.texts.map((t) => t.id), (el) => ('look' in el ? { look: { role, color: el.look.color, align: el.look.align } } : {}))}
            />
          ) : null}
          {style.texts.length ? <Gap /> : null}
          <BoxTools style={style} canvas={canvas} used={used} />
          <Gap />
          <ArrangeTools canvas={canvas} picked={style.picked} />
          {style.role ? (
            <>
              <Gap />
              <Segmented<Scope> label="Change" options={['one', 'all']} value={style.scope} onChange={style.setScope} labels={{ one: style.texts.length > 1 ? 'These' : 'This one', all: allLabel }} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
