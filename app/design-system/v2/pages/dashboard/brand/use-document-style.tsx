'use client';

import { useMemo, useState, type ReactNode } from 'react';

import type { Brand } from '../../onboarding/use-onboarding-state';
import { AccountContext, useAccount, type Account } from '../account';

import { useBrandWriter } from './brand-provider';
import type { MiniKind } from './mini-docs';
import { DEFAULT_BRAND } from './palettes';

/**
 * One document's look, for its editor: the account's brand, or this
 * document's own one-off look once the MC picks "Just this one". The
 * editor wraps its live preview in {@link StyleScope}, so the page shows
 * exactly what this document will be sent in. (Its look is set in the
 * canvas now: the editor's Design button, and the brand kit.)
 *
 * Changing the look while it is "Everywhere" saves the brand for every
 * document (with the ripple); "Just this one" keeps the change on this
 * document, and going back to Everywhere drops it, so the document
 * follows the brand again.
 *
 * @module app/design-system/v2/pages/dashboard/brand/use-document-style
 */

/** Where a document's look change lands: the brand, or this document alone. */
export type Scope = 'Everywhere' | 'Just this one';

export interface DocumentStyle {
  /** The look this document wears now. */
  brand: Brand;
  scope: Scope;
  setScope: (s: Scope) => void;
  /** Changes the look, in the current scope. */
  change: (b: Brand) => void;
  /** Whether this document's ripple is showing. */
  rippling: boolean;
  /** The document, as the ripple and the scope note name it. */
  doc: MiniKind;
  /** The account as this document sees it: its look in place of the brand. */
  look: Account;
}

/** Gives what it wraps the document's look (its preview). */
export function StyleScope({ style, children }: { style: DocumentStyle; children: ReactNode }) {
  return <AccountContext.Provider value={style.look}>{children}</AccountContext.Provider>;
}

/** The look of the document an editor is open on (`doc`). See {@link DocumentStyle}. */
export function useDocumentStyle(doc: MiniKind): DocumentStyle {
  const account = useAccount();
  const { save, ripple } = useBrandWriter();
  const [own, setOwn] = useState<Brand | null>(null);
  const everywhere = account.brand ?? DEFAULT_BRAND;
  const brand = own ?? everywhere;
  const look = useMemo(() => ({ ...account, brand }), [account, brand]);
  return {
    brand,
    scope: own ? 'Just this one' : 'Everywhere',
    // Just this one starts from the brand as it is; Everywhere lets go of the one-off.
    setScope: (s) => setOwn(s === 'Just this one' ? everywhere : null),
    change: (b) => (own ? setOwn(b) : save(b, doc)),
    rippling: ripple === doc,
    doc,
    look,
  };
}
