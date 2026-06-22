/**
 * Hard-load / refresh fallback for `/settings`. Soft navigation is
 * handled by the `@modal/(.)settings` intercepting route, which keeps
 * the originating page behind the modal. On a direct hit or refresh
 * there is no originating page, so we render the dashboard home as the
 * backdrop and the Settings modal on top of it.
 *
 * @module app/(dashboard)/settings/page
 */
'use client';

import { Suspense } from 'react';

import DashboardPage from '../page';

import { SettingsModal } from './settings-modal';

export default function SettingsRouteFallback() {
  return (
    <Suspense>
      <DashboardPage />
      <SettingsModal />
    </Suspense>
  );
}
