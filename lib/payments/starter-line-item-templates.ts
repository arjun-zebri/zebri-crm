/**
 * Seeded starter catalogs for the line-item template types, packages,
 * and invoice templates.
 *
 * These mirror `lib/email/starter-templates.ts`: nothing is auto-seeded;
 * the Templates page surfaces them through a "Browse starters" modal and
 * an MC adds the ones they want. Added rows are flagged `is_starter` for
 * provenance but stay fully editable and deletable.
 *
 * All three types share the same shape (a named set of priced line
 * items), so they reuse one {@link StarterLineItemSet} type and one
 * {@link startersByName} resolver, parameterised by catalog.
 *
 * The dollar amounts are **suggested AU placeholders** for a wedding MC;
 * every MC is expected to edit them to their own rates after adding.
 *
 * @module lib/payments/starter-line-item-templates
 */

/** A single suggested line item within a starter set. */
export interface StarterLineItem {
  description: string
  /** Suggested AUD amount; `0` means "MC fills this in". */
  amount: number
}

/** A named starter set of priced line items (package / invoice). */
export interface StarterLineItemSet {
  name: string
  /** Short subtitle shown on the list row and starter catalog. */
  subtitle: string
  items: StarterLineItem[]
}

/* ─── Packages: reusable service bundles ───────────────────────── */

/** Starter service packages an MC can drop into invoices. */
export const STARTER_PACKAGES: readonly StarterLineItemSet[] = [
  {
    name: 'Ceremony MC',
    subtitle: 'Hosting and coordination for your ceremony',
    items: [
      { description: 'Pre-ceremony consultation', amount: 0 },
      { description: 'Ceremony hosting & coordination', amount: 550 },
    ],
  },
  {
    name: 'Reception MC',
    subtitle: 'Full reception hosting and run-sheet management',
    items: [
      { description: 'Planning meeting', amount: 0 },
      { description: 'Reception MC & run sheet', amount: 900 },
    ],
  },
  {
    name: 'Full Day MC',
    subtitle: 'Ceremony and reception, start to finish',
    items: [
      { description: 'Pre-wedding consultation', amount: 0 },
      { description: 'Ceremony hosting', amount: 550 },
      { description: 'Reception MC & run sheet', amount: 900 },
    ],
  },
]

/* ─── Invoice templates: reusable invoices ─────────────────────── */

/** Starter invoice templates for the usual deposit / balance flow. */
export const STARTER_INVOICE_TEMPLATES: readonly StarterLineItemSet[] = [
  {
    name: 'Booking Deposit',
    subtitle: 'Secures the date',
    items: [{ description: 'Booking deposit (non-refundable)', amount: 400 }],
  },
  {
    name: 'Final Balance',
    subtitle: 'Due before the wedding',
    items: [{ description: 'Balance of MC services', amount: 1050 }],
  },
  {
    name: 'Paid in Full',
    subtitle: 'Full payment in a single invoice',
    items: [{ description: 'Wedding MC services', amount: 1450 }],
  },
]

/* ─── Resolver ─────────────────────────────────────────────────── */

/**
 * Resolve catalog entries by name from a given starter catalog.
 *
 * Unknown names are silently dropped so a stale client request can never
 * inject arbitrary content, the server only ever inserts canonical sets.
 */
export function startersByName(
  catalog: readonly StarterLineItemSet[],
  names: readonly string[],
): StarterLineItemSet[] {
  const wanted = new Set(names)
  return catalog.filter((s) => wanted.has(s.name))
}
