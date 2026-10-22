'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { EARLY_ACCESS_ID, JumpButton } from './jump-button';
import { NAV_LINKS, sectionHref, type SitePage } from './nav-links';
import { useSiteNavMenu } from './site-nav-menu';

/**
 * The marketing page's top bar, full width like Stripe's: the logo left,
 * the section links centred on the page (founder brief, 2026-10-17), the
 * actions right; transparent at the top, a frosted white bar with a
 * hairline once the page scrolls. It uses
 * `zebri-logo-clear.svg`, the brand logo with its white ground removed:
 * the original's ground showed as a white box on the mesh, and a blend
 * mode cannot reach past the fixed bar's own stacking context.
 * Below `lg` the anchors and Log in move into a menu
 * (`site-nav-menu.tsx`).
 *
 * @module app/design-system/v2/pages/website/site-nav
 */

/**
 * Which band is on screen, for the nav's current-section mark. Watches a
 * thin line a third of the way down the viewport. Every band with an
 * `id` is watched, so a band with no link of its own lights none.
 */
function useCurrentSection() {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { rootMargin: '-33% 0px -66% 0px' },
    );
    for (const el of document.querySelectorAll('main section[id]')) observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return current;
}

/** True once the page has scrolled off its top. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

/** The sticky top bar. `page` marks a page of its own (Blocks, Guides) current; the home page marks its bands. */
export function SiteNav({ page }: { page?: SitePage | undefined } = {}) {
  const current = useCurrentSection();
  const scrolled = useScrolled();
  const menu = useSiteNavMenu();
  return (
    <header
      // The gutter is on the bar and the width on the nav, as on every band below,
      // so the logo and the button line up with the page's content edges.
      className={`fixed inset-x-0 top-0 z-30 px-5 sm:px-8 transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none ${
        scrolled ? 'bg-field/80 shadow-[0_1px_0_var(--color-hairline)] backdrop-blur-xl' : ''
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center lg:grid lg:grid-cols-[1fr_auto_1fr]"
      >
        <a
          href={sectionHref('top')}
          className="flex shrink-0 items-center justify-self-start rounded-check focus-mark"
          aria-label="Zebri home"
        >
          {/* Eager: on a phone the logo is the largest thing above the fold (its LCP). */}
          <Image
            src="/zebri-logo-clear.svg"
            alt=""
            width={78}
            height={28}
            loading="eager"
            fetchPriority="high"
            className="h-7 w-auto"
          />
        </a>
        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              {/* The current section is underlined in the brand green: the darker grey alone was too quiet to see. */}
              <a
                href={link.href}
                aria-current={
                  page
                    ? link.page === page
                      ? 'page'
                      : undefined
                    : current && link.lights.includes(current)
                      ? 'location'
                      : undefined
                }
                className="rounded-check type-body text-zebra-700 decoration-grass-700 decoration-2 underline-offset-8 transition-colors duration-150 hover:text-zebra-950 focus-mark aria-[current=location]:text-zebra-950 aria-[current=location]:underline aria-[current=page]:text-zebra-950 aria-[current=page]:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2 lg:justify-self-end md:gap-5">
          {/* A plain label like the links beside it: underlined, it was the loudest thing in the bar. */}
          <a
            href="/design-system/v2/login"
            className="rounded-check type-body text-zebra-700 transition-colors duration-150 hover:text-zebra-950 focus-mark max-lg:hidden"
          >
            Log in
          </a>
          {/* On a phone's first screen the hero's own button is right there; this one joins once the page scrolls. */}
          {/* "Join the waitlist", not "Get early access": people are let in a few at a time (founder, 2026-10-19). */}
          <JumpButton
            to={EARLY_ACCESS_ID}
            arrow
            className={scrolled ? undefined : 'max-md:hidden'}
          >
            Join the waitlist
          </JumpButton>
          {menu.button}
        </div>
      </nav>
      {menu.panel}
    </header>
  );
}
