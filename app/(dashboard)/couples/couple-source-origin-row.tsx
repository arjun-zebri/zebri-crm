/**
 * Read-only "Enquiry from" row for the couple overview: the site an API or
 * embed enquiry was posted from. Server-set, so there is no edit affordance.
 * Renders nothing when the couple has no recorded origin.
 *
 * @module app/(dashboard)/couples/couple-source-origin-row
 */
import { hostOf } from "@/lib/lead-capture/cors";

export function CoupleSourceOriginRow({ sourceOrigin }: { sourceOrigin: string | null | undefined }) {
  if (!sourceOrigin) return null;
  return (
    // The sibling rows in couple-overview.tsx still use the legacy
    // text-gray-700 label class; the couple-page hardening will sweep that
    // file, so this new file uses the design-system token instead.
    <div className="flex items-center justify-between py-3 -mx-2 px-2">
      <span className="text-body text-text w-28 shrink-0">Enquiry from</span>
      <span className="text-body text-text-muted truncate">{hostOf(sourceOrigin)}</span>
    </div>
  );
}
