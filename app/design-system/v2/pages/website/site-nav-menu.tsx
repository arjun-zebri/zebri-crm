'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Collapse } from '@/components/ui-v2/collapse';
import { CloseIcon, MenuIcon } from '@/components/ui-v2/icons';

import { NAV_LINKS } from './nav-links';

/**
 * The marketing nav on a phone or tablet: a menu button that folds open
 * the section anchors and Log in under the bar. Below `lg` the bar has
 * room only for the logo and "Get early access" (at 768 the six links,
 * Log in and the button wrapped onto two lines), and without this a returning
 * user had no way to log in from the homepage, and a visitor no way to
 * jump around a fourteen-thousand-pixel scroll.
 *
 * Closes on a link, on Escape (focus goes back to the button), and when
 * the screen widens past the phone layout.
 *
 * @module app/design-system/v2/pages/website/site-nav-menu
 */

const LOGIN_HREF = '/design-system/v2/login';

/**
 * The panel's id, fixed: there is one nav on the page, and a `useId`
 * here came out different on the server and the client (the showroom
 * layout's tree above it differs), which broke hydration.
 */
const PANEL_ID = 'site-nav-menu';

/** The menu button, for the bar, and its fold-open panel, for under the bar. */
export function useSiteNavMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      document.querySelector<HTMLElement>(`[aria-controls="${PANEL_ID}"]`)?.focus();
    };
    // The panel only exists below lg; a rotate or resize to a wide screen shuts it.
    // Feature-checked, as the page's observers are: without it, Escape still works.
    const wide =
      typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 64rem)') : null;
    const onWide = () => wide?.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    wide?.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKey);
      wide?.removeEventListener('change', onWide);
    };
  }, [open]);

  const button = (
    <span className="lg:hidden">
      <Button
        variant="ghost"
        square
        tooltip={false}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        icon={open ? <CloseIcon className="size-4" /> : <MenuIcon className="size-4" />}
        onClick={() => setOpen(!open)}
      />
    </span>
  );

  const panel = (
    <div id={PANEL_ID} className="mx-auto max-w-6xl lg:hidden">
      <Collapse open={open}>
        <nav
          aria-label="Sections"
          className="mt-2 rounded-panel bg-field p-2 shadow-lg ring-1 ring-hairline"
        >
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center rounded-button px-3 type-body text-zebra-950 hover:bg-hover focus-mark"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-2 border-t border-hairline pt-2">
              <a
                href={LOGIN_HREF}
                className="flex h-11 items-center rounded-button px-3 type-body text-zebra-950 hover:bg-hover focus-mark"
              >
                Log in
              </a>
            </li>
          </ul>
        </nav>
      </Collapse>
    </div>
  );

  return { button, panel };
}
