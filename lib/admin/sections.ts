/**
 * Admin's top-level sections. Dashboard and Users share `/admin` (a
 * `?tab=`). Outreach is not one of them: it has its own sidebar entry
 * and route (`/admin/outreach`), so it never sits under a second row of
 * tabs.
 *
 * @module lib/admin/sections
 */

/** Top-level admin sections. */
export type AdminSection = 'dashboard' | 'users';

/** Tabs for the top-level admin sections, in display order. */
export const ADMIN_SECTIONS: { id: AdminSection; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
];

/** URL for a top-level admin section. */
export function adminSectionHref(id: AdminSection): string {
  return `/admin?tab=${id}`;
}
