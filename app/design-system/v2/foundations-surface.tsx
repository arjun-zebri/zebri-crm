import { Backdrop } from '@/components/ui-v2/backdrop';
import { Panel } from '@/components/ui-v2/panel';

import { Spec } from './showroom-v2';

/**
 * v2 background and surface: the grass and sky backdrop with a glass
 * panel on it holding one highlight panel, beside a plain glass panel,
 * in a frame tall enough to judge how the glass sits over the green and
 * the blue ends of the wash.
 * Deliberately empty so the surfaces are judged on their own.
 *
 * @module app/design-system/v2/foundations-surface
 */
export function FoundationsSurfaceV2() {
  return (
    <Spec name="Background & panels" file="components/ui-v2/panel.tsx">
      {/* `isolate` keeps the contained backdrop's -z-10 inside this frame. */}
      <div className="relative isolate flex min-h-[42rem] flex-wrap items-center justify-center gap-6 overflow-hidden rounded-panel p-4 sm:p-6">
        <Backdrop contained />
        <Panel className="w-full max-w-md p-8 sm:p-10">
          <Panel tone="highlight" className="h-48" />
        </Panel>
        <Panel className="flex h-64 w-full max-w-xs items-end p-6">
          <p className="type-body text-zebra-600">Glass: every card in the app</p>
        </Panel>
      </div>
    </Spec>
  );
}
