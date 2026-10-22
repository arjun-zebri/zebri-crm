'use client';

import { useEffect, useState } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';
import { PaletteIcon } from '@/components/ui-v2/icons';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useAccount } from '../account';
import { EditorHeader } from '../canvas/editor-header';

import { useBrandKit } from './brand-provider';
import type { BrandKit } from './kit';
import { KitAppearance } from './kit-appearance';
import { KitDocuments, type KitDoc } from './kit-documents';
import { closeYourLook, useYourLookOpen } from './your-look-store';

/**
 * The brand kit: one place for how everything the MC sends looks
 * (founder's mockup, 2026-10-11). The design editor's header across the
 * top (the one `EditorHeader`, shared with the canvas's Design dialog:
 * "Saved" once something changed, Close at the right), then the look's
 * settings on the left and the live preview on the right: one document at
 * a time, picked from the menu over it. Business
 * details and the email signature live in Settings (founder, 2026-10-11:
 * they are not branding). Opened from the name card in the sidebar and
 * from Brand kit in every document editor. An `xl` dialog, not full
 * screen: with one list on the left, the wider sheet was mostly empty.
 * Fixed while open; each side scrolls on its own.
 *
 * @module app/design-system/v2/pages/dashboard/brand/brand-kit-dialog
 */

/** The dialog; each dashboard page renders it once. */
export function BrandKitDialog() {
  const open = useYourLookOpen();
  return (
    <Dialog open={open} onClose={closeYourLook} size="xl" aria-labelledby="brand-kit-title">
      {open ? <KitBody /> : null}
    </Dialog>
  );
}

/** The open kit; mounted per opening, so it starts with nothing "Saved" yet. */
function KitBody() {
  const { kit, saveKit } = useBrandKit();
  const { business } = useAccount();
  const [doc, setDoc] = useState<KitDoc>('proposal');
  const [saved, setSaved] = useState(false);
  // Every face the kit can pick, so the font menus show each in its own face.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const save = (next: BrandKit) => {
    saveKit(next);
    setSaved(true);
  };
  return (
    <>
      <EditorHeader id="brand-kit-title" icon={PaletteIcon} title="Global styling" saved={saved} onClose={closeYourLook} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-8 pt-2 lg:w-[26rem] lg:flex-none">
          {/* What this is, and what it changes and what it leaves alone (founder, 2026-10-21). */}
          <p className="max-w-sm pb-6 pt-2 type-body text-zebra-500">
            Your logo, colours, fonts and spacing, shared by every document. Changes show straight away on templates and documents you have not sent. Sent documents keep the look they went out with, and anything you styled by hand in a document stays as you set it.
          </p>
          <KitAppearance kit={kit} business={business} onChange={save} />
        </div>
        <aside aria-label="Preview" className="flex min-w-0 flex-1 flex-col bg-zebra-50 max-lg:hidden">
          <KitDocuments doc={doc} onDoc={setDoc} />
        </aside>
      </div>
    </>
  );
}
