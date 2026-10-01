import Image from 'next/image';
import { useId, type ReactNode } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { Panel } from '@/components/ui-v2/panel';

/**
 * The frame both v2 auth pages share: the backdrop and one panel that
 * holds everything (the Z mark and heading, the form, the sign-in options
 * and the link to the other page), so the page reads as a single card.
 *
 * @module app/design-system/v2/pages/auth-shell
 */

export interface AuthShellProps {
  /** Heading under the logo ("Welcome back", "Create your account"). */
  title: string;
  /** The form and anything below it. */
  children: ReactNode;
  /** The last line in the card (e.g. "Don't have an account? Sign up"). */
  footer: ReactNode;
  /**
   * Render inside a preview frame instead of filling the screen. Also
   * demotes the heading to `h2`, since the showroom page has its own `h1`.
   */
  contained?: boolean;
}

/** v2 auth page frame. See {@link AuthShellProps}. */
export function AuthShell({ title, children, footer, contained = false }: AuthShellProps) {
  const Heading = contained ? 'h2' : 'h1';
  // Both previews render on one showroom page, so the id must be unique.
  const titleId = useId();
  return (
    // `isolate` gives the backdrop's -z-10 a stacking context of its own,
    // so it paints above the layout's page colour rather than beneath it.
    <div
      className={`relative isolate flex flex-col items-center justify-center px-4 py-12 ${contained ? 'min-h-[50rem] overflow-hidden rounded-panel' : 'min-h-screen'}`}
    >
      <Backdrop contained={contained} />
      <Panel as="section" aria-labelledby={titleId} className="w-full max-w-sm space-y-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* The Z mark rather than the wordmark: small, and sharp at this
              size. Its SVG has a white square baked in; multiply drops it
              out against the panel without editing the official asset. */}
          <Image src="/zebri-icon.svg" alt="Zebri" width={36} height={36} className="size-9 mix-blend-multiply" />
          <Heading id={titleId} className="type-subheading text-zebra-950">
            {title}
          </Heading>
        </div>
        {children}
        <p className="text-center type-body text-zebra-500">{footer}</p>
      </Panel>
    </div>
  );
}
