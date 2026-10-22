/**
 * The MC's catalogue for the v2 Payments demo, in its own module so the
 * invoice data and the generated bookings can both read it without
 * importing each other.
 *
 * @module app/design-system/v2/pages/dashboard/payments/services
 */

/** One package the MC sells, as it appears on an invoice. */
export interface Package {
  item: string;
  total: number;
}

/**
 * What the MC sells, grouped the way they would break the business down:
 * each service (a type of job) and its packages. Invoices name their
 * package in `item`, which is how the Overview's chart slices by either.
 */
export const SERVICES: { id: string; name: string; packages: Package[] }[] = [
  {
    id: 'mc',
    name: 'MC',
    packages: [
      { item: 'Classic MC package', total: 3600 },
      { item: 'Premium MC package', total: 4350 },
    ],
  },
  { id: 'mc-celebrant', name: 'MC + Celebrant', packages: [{ item: 'Ceremony and reception', total: 5200 }] },
  { id: 'celebrant', name: 'Celebrant', packages: [{ item: 'Ceremony only', total: 1900 }] },
  { id: 'corporate', name: 'Corporate', packages: [{ item: 'Corporate MC', total: 2800 }] },
];

/** The service a package belongs to, by the invoice's `item`. */
export const serviceOf = (item: string) => SERVICES.find((s) => s.packages.some((p) => p.item === item));
