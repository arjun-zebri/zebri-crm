'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { CATALOG } from '../../dashboard/blocks/catalog';
import { BLOCK_IMAGES } from '../../dashboard/blocks/images/registry';
import type { Showcase } from '../../dashboard/showcase';
import { BlockPicture } from '../block-picture';
import { DocsAccount, STEP_SCENES } from '../journey-docs';

/**
 * The marketing site's product pictures, each alone at its real size, for
 * zebri-landing's `scripts/capture-product-shots.mjs` to photograph at 2x.
 * The live site shows images of the app rather than the app itself, so it
 * does not carry the CRM's code; when the app's UI changes, re-run the
 * script. Each picture is a box with `data-capture="<file name>"`.
 *
 * @module app/design-system/v2/pages/website/capture/capture-sheet
 */

const Dashboard = dynamic(
  () => import('../../dashboard/dashboard-page').then((m) => m.DashboardPageV2),
  { ssr: false },
);

const SHOWCASE: Showcase = { firstName: 'Jess', name: 'Jess Taylor' };

/** The scene names, by step, as the landing site's files are named. */
const SCENE_NAMES = ['welcome', 'proposal', 'contract', 'deposit', 'noim', 'balance'];

/** Every picture, stacked down the page. */
export function CaptureSheet() {
  useEffect(() => ensureBrandFontsStylesheet(), []);
  return (
    <div className="space-y-10 bg-zebra-200 p-10">
      <div data-capture="hero-dashboard" className="relative isolate h-[46rem] w-[80rem] overflow-hidden">
        <Dashboard contained sidebarCollapsed showcase={SHOWCASE} />
      </div>
      {STEP_SCENES.map((Scene, i) => (
        <div
          key={SCENE_NAMES[i]}
          data-capture={`journey-${SCENE_NAMES[i]}`}
          className="relative h-[30rem] w-[42.5rem] overflow-hidden bg-zebra-50"
        >
          <DocsAccount>
            <Scene />
          </DocsAccount>
        </div>
      ))}
      {CATALOG.filter((b) => BLOCK_IMAGES[b.id]).map((b) => (
        <div key={b.id} data-capture={`block-${b.id}`} className="w-[45rem]">
          <BlockPicture id={b.id} />
        </div>
      ))}
    </div>
  );
}
