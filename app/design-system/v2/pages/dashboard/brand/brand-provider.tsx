'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Brand } from '../../onboarding/use-onboarding-state';
import { AccountContext, useAccount, type Account } from '../account';

import { brandOf, kitFrom, type BrandKit, type KitDetails } from './kit';

/**
 * The account's brand, live for the whole dashboard. Every editor's Style
 * pill writes here, and everything that reads `useAccount().brand` (the
 * proposal, contract and invoice pages, emails, template cards) wears a
 * change the moment it is made. The account's own `saveBrand` still hears
 * every change (a new account keeps it); the demo business has none, so
 * its brand lasts the visit. An account that has not made it theirs
 * wears Zebri's default look everywhere, so every document matches from
 * the start (the proposal used to be green while the invoice was plain).
 *
 * What it holds is the full brand kit ({@link BrandKit}: logos, palettes,
 * text styles, house style, assets), which the canvas editor reads and
 * writes; the one-colour `Brand` the older renderers read is derived from
 * it, and a `Brand` saved by them is folded back into the kit.
 *
 * A change made "everywhere" from inside one document announces itself:
 * `ripple` names that document for a few seconds, and the Style pill
 * there shows the ripple strip (the other documents restyled), so the MC
 * sees the reach of what they just did. The pill draws it, not this
 * provider, because editors are modal dialogs and the page under them
 * is inert.
 *
 * @module app/design-system/v2/pages/dashboard/brand/brand-provider
 */

/** How long the ripple stays up after the last change. */
const RIPPLE_MS = 3200;

/** Saves the brand everywhere; `from` names the document it was changed in, for the ripple. */
type SaveEverywhere = (brand: Brand, from?: string) => void;

interface BrandWriter {
  save: SaveEverywhere;
  /** The document an everywhere change just came from, while its ripple shows. */
  ripple: string | null;
}

const WriterContext = createContext<BrandWriter>({ save: () => undefined, ripple: null });

interface KitStore {
  kit: BrandKit;
  /** Saves the whole kit; `from` names the document it was changed in, for the ripple. */
  saveKit: (kit: BrandKit, from?: string) => void;
}

const KitContext = createContext<KitStore>({ kit: kitFrom(), saveKit: () => undefined });

/** The brand kit, and how to change it. */
export const useBrandKit = () => useContext(KitContext);

/** A kit with a one-colour brand folded in: its colours, fonts and main logo. */
function withBrand(kit: BrandKit, b: Brand): BrandKit {
  const set = (id: string, hex: string) => kit.palettes.map((p) => ({ ...p, colours: p.colours.map((c) => (c.id === id ? { ...c, hex } : c)) }));
  const palettes = set('primary', b.primary).map((p) => ({ ...p, colours: p.colours.map((c) => (c.id === 'accent' ? { ...c, hex: b.secondary } : c)) }));
  return {
    ...kit,
    palettes,
    text: {
      heading: { ...kit.text.heading, font: b.headingFont },
      subheading: { ...kit.text.subheading, font: b.headingFont },
      body: { ...kit.text.body, font: b.bodyFont },
      caption: { ...kit.text.caption, font: b.bodyFont },
    },
    logos: kit.logos.map((l) => (l.id === 'main' ? { ...l, src: b.logoUrl } : l)),
  };
}

/** The account's business, MC and contact as the brand kit's Business details have them. */
function detailsAccount(account: Account, d: KitDetails | undefined): Partial<Account> {
  if (!d) return {};
  return {
    business: d.business,
    mc: { name: d.name, role: d.role },
    contact: { abn: d.abn, email: d.email, phone: d.phone, bank: account.contact?.bank ?? '' },
  };
}

/** Saves brand changes everywhere, and which document's ripple is showing. */
export const useBrandWriter = () => useContext(WriterContext);

/** Provides the live brand to what it wraps. */
export function BrandProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [kit, setKit] = useState<BrandKit>(() => kitFrom(account.brand ?? undefined));
  const [ripple, setRipple] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const { saveBrand } = account;
  const announce = useCallback((from?: string) => {
    if (!from) return;
    // One strip per burst of changes: dragging a colour keeps it up, then it settles.
    setRipple(from);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRipple(null), RIPPLE_MS);
  }, []);
  const saveKit = useCallback(
    (next: BrandKit, from?: string) => {
      setKit(next);
      saveBrand?.(brandOf(next));
      announce(from);
    },
    [saveBrand, announce],
  );
  const save = useCallback<SaveEverywhere>((b, from) => saveKit(withBrand(kit, b), from), [kit, saveKit]);
  const brand = useMemo(() => brandOf(kit), [kit]);
  // Business details set in the brand kit stand in for the account's, so every page that names the business follows.
  const value = useMemo(() => ({ ...account, ...detailsAccount(account, kit.details), brand, saveBrand: (b: Brand) => save(b) }), [account, kit.details, brand, save]);
  const writer = useMemo(() => ({ save, ripple }), [save, ripple]);
  const store = useMemo(() => ({ kit, saveKit }), [kit, saveKit]);
  return (
    <AccountContext.Provider value={value}>
      <KitContext.Provider value={store}>
        <WriterContext.Provider value={writer}>{children}</WriterContext.Provider>
      </KitContext.Provider>
    </AccountContext.Provider>
  );
}
