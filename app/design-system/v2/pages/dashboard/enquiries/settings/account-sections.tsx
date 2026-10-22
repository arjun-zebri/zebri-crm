'use client';

import { ConnectRow, SettingsSection } from './pane-parts';
import { INBOXES, INSTAGRAM } from './settings-data';
import type { EnquirySettings } from './use-enquiry-settings';

/**
 * The Enquiries tab's one section: the inboxes and Instagram as rows of
 * the same shape. There is no website form or directory section: both
 * already email the MC, so a connected inbox brings their enquiries in
 * and Zebri's AI sorts them out and names the source (user's call,
 * 2026-10-02). The line under the rows says so, so nobody goes looking
 * for them. All simulated.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/settings/account-sections
 */
export function MessagesSection({ settings: s }: { settings: EnquirySettings }) {
  return (
    <SettingsSection title="Messages" why="Enquiries in your inbox and Instagram show up here, and you reply without leaving Zebri.">
      <div className="space-y-2">
        {[...INBOXES, INSTAGRAM].map((a) => (
          <ConnectRow key={a.id} account={a} settings={s} />
        ))}
      </div>
      <p className="pt-2 type-body text-zebra-500">
        Enquiries from your website form and the directories you&apos;re listed on arrive by email, so connecting your
        inbox brings them in too.
      </p>
    </SettingsSection>
  );
}
