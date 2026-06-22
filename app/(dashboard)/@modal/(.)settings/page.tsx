/**
 * Intercepting route: when the user soft-navigates to `/settings`
 * from within the dashboard (e.g. the sidebar link), render the
 * Settings modal as an overlay over the current page instead of a
 * full-page navigation.
 *
 * @module app/(dashboard)/@modal/(.)settings/page
 */
import { Suspense } from 'react';

import { SettingsModal } from '../../settings/settings-modal';

export default function InterceptedSettingsPage() {
  return (
    <Suspense>
      <SettingsModal />
    </Suspense>
  );
}
