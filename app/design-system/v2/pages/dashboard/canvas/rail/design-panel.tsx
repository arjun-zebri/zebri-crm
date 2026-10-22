'use client';

import { Button } from '@/components/ui-v2/button';
import { CopyLinkIcon, PlusIcon, TrashIcon } from '@/components/ui-v2/icons';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { SwatchPicker } from '@/components/ui-v2/swatch-picker';

import { kitColours, kitHexOf } from '../../brand/kit';
import { useCanvasData } from '../canvas-context';
import { ICON } from '../icon-props';
import { refOf } from '../look';
import { colorOf } from '../resolve';
import { StaticPage } from '../static-page';

import type { RailApi } from './api';

/**
 * The Design tab: the document's pages, as Canva lists them, each a
 * small picture of itself (click to go to it), with duplicate and delete;
 * a new blank page at the end; and the pages' colour. A page holding a
 * required part cannot be deleted, nor can the last page.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/design-panel
 */

/** The Design tab. */
export function DesignPanel({ api }: { api: RailApi }) {
  const { kit } = useCanvasData();
  const { canvas } = api;
  const pages = canvas.doc.pages;
  const show = (id: string) => document.querySelector(`[data-page="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="space-y-6">
      <SwatchPicker
        label="Page colour"
        swatches={kitColours(kit).map((c) => ({ value: c.hex, name: c.name }))}
        value={colorOf(pages[0]?.background, kit) ?? kitHexOf(kit, 'paper')}
        onChange={(hex) => canvas.pageStyle({ background: refOf(hex, kit) })}
      />
      <section aria-label="Pages" className="space-y-3">
        <h3 className="type-label text-zebra-950">Pages</h3>
        <ol className="space-y-4">
          {pages.map((p, i) => {
            const keeps = pages.length === 1 || p.elements.some((e) => e.locked);
            return (
              <li key={p.id} className="flex items-start gap-3">
                <span className="w-4 pt-1 text-right type-numeric text-zebra-500">{i + 1}</span>
                {/* Rounded like its focus mark; on hover, the canvas's hover outline (the selected colour, lighter). */}
                <div className="relative rounded-button shadow-sm ring-1 ring-hairline transition-shadow duration-150 hover:ring-selected/50 motion-reduce:transition-none">
                  <StretchedButton label={`Go to page ${i + 1}`} onClick={() => show(p.id)} radius="button">
                    <span aria-hidden="true" inert className="block overflow-hidden rounded-button">
                      <StaticPage page={p} scale={0.17} />
                    </span>
                  </StretchedButton>
                </div>
                <div className="flex flex-col">
                  <Button variant="ghost" square aria-label={`Duplicate page ${i + 1}`} tooltip="Duplicate" onClick={() => canvas.duplicatePage(p.id)}>
                    <CopyLinkIcon {...ICON} />
                  </Button>
                  {keeps ? null : (
                    <Button variant="ghost" square aria-label={`Delete page ${i + 1}`} tooltip="Delete" onClick={() => canvas.removePage(p.id)}>
                      <TrashIcon {...ICON} />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <Button variant="secondary" icon={<PlusIcon {...ICON} />} onClick={() => canvas.addPage(pages.at(-1)!.id)}>
          Add a page
        </Button>
      </section>
    </div>
  );
}
