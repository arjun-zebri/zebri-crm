/**
 * The onboarding's package model: what the brand preview and
 * documents show.
 *
 * @module app/design-system/v2/pages/onboarding/packages
 */

/** One package as the demo holds it. */
export interface DemoPackage {
  name: string;
  price: number;
  lines: string[];
}

/**
 * @deprecated The one money format is `money()` in payments-data; this
 * alias only keeps older imports compiling.
 */
export { money as aud } from '../dashboard/payments/payments-data';
