'use client';

import { DocumentPage } from '@/components/ui-v2/document-page';

import { useAccount } from '../../account';
import { useBrandKit } from '../../brand/brand-provider';
import { engineDesignOf, isEngineDesign, type EngineDesignData, type EngineDesignKind } from '../../doc-builder/doc-types/designed';
import { useKitLook } from '../../doc-builder/look/use-kit-look';
import { docFor } from '../../doc-builder/model/doc-data';
import type { DocLayout } from '../../doc-builder/model/types';
import { CouplePage } from '../../doc-builder/render/couple-page';
import { DocPartsProvider } from '../../doc-builder/sections/parts/parts';
import { CanvasDataProvider } from '../canvas-context';
import { StaticPage } from '../static-page';

import { useDesign, useLayout } from './design-store';
import { SPECS } from './registry';
import type { DesignKind } from './spec';

/**
 * A document as the couple gets it, drawn from the MC's design for its
 * kind and filled with its real data: every page, in the brand kit, each
 * a real-size A4 page scaled to the width it is given. What the editors show and what is
 * sent, so the design and the document can never differ. A
 * questionnaire, contract or invoice is a web page from the engine
 * (`EngineDesigned`), on the same paper card.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/designed
 */

export interface DesignedProps {
  kind: DesignKind;
  /** The document's data, the shape its spec fills from. */
  data: unknown;
  /** Names the pages for screen readers ("Invoice #1001"). */
  label: string;
  /** An engine document's own frozen copy (a sent contract's), in place of the MC's current one. */
  layout?: DocLayout | undefined;
}

/** The designed document. See {@link DesignedProps}. */
export function Designed({ kind, data, label, layout }: DesignedProps) {
  if (isEngineDesign(kind)) return <EngineDesigned kind={kind} data={data} label={label} frozen={layout} />;
  return <CanvasDesigned kind={kind} data={data} label={label} />;
}

/** A canvas design: real-size A4 pages. */
function CanvasDesigned({ kind, data, label }: DesignedProps) {
  const account = useAccount();
  const { kit } = useBrandKit();
  const doc = useDesign(kind);
  const fills = SPECS[kind].fill(data, account);
  return (
    <CanvasDataProvider value={{ kit, business: account.business, ...fills }}>
      <div className="space-y-6">
        {doc.pages.map((p, i) => (
          // Each page at real size, scaled as a whole to the width it is given (as the paper copy).
          <DocumentPage key={p.id} aria-label={doc.pages.length > 1 ? `${label}, page ${i + 1} of ${doc.pages.length}` : label}>
            <StaticPage page={p} />
          </DocumentPage>
        ))}
      </div>
    </CanvasDataProvider>
  );
}

/** An engine design: the MC's stack of sections, its working parts drawn from `data`. */
function EngineDesigned({ kind, data, label, frozen }: { kind: EngineDesignKind; data: unknown; label: string; frozen: DocLayout | undefined }) {
  const account = useAccount();
  const current = useLayout(kind, account);
  const layout = frozen ?? current;
  const { branding, theme } = useKitLook();
  const design = engineDesignOf(kind);
  // Each preview hands over its own kind's data, as the Design button does.
  const filled = data as EngineDesignData[EngineDesignKind];
  return (
    <DocPartsProvider parts={design.parts(filled, account)} fields={design.fields(filled, account)}>
      <article aria-label={label} className="mx-auto w-full max-w-3xl overflow-hidden rounded-check bg-field shadow-lg ring-1 ring-hairline">
        <CouplePage
          layout={{ ...layout, theme }}
          branding={branding}
          doc={docFor(design.who(filled, account), account.deposit)}
          terms={{ contract: false, deposit: account.deposit, balanceDays: 30 }}
          mode="print"
        />
      </article>
    </DocPartsProvider>
  );
}
