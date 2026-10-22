import Image from 'next/image';

import { FacebookIcon, InstagramIcon, LinkedinIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { FOOTER_PRODUCT_LINKS, GUIDES_PATH, sectionHref } from './nav-links';

/**
 * The footer: the logo and one line, columns (Product, Resources,
 * Company, Legal)
 * and the company line naming the operator, as the privacy policy does.
 * Quiet on purpose, in the nav's 13px (founder, 2026-10-18: a giant
 * faint wordmark was rejected). The founding panel above is the close.
 * Product lists every feature band, in page order, with the nav's labels
 * where they share one (2026-10-18 page review: they had drifted); the
 * nav itself carries a shorter list (`nav-links.ts`). Under the logo,
 * Zebri's social accounts: the audience lives on Instagram.
 *
 * @module app/design-system/v2/pages/website/site-footer
 */

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: FOOTER_PRODUCT_LINKS.map(({ href, label }) => ({ href, label })),
  },
  {
    title: 'Resources',
    links: [
      { href: GUIDES_PATH, label: 'Guides' },
      { href: sectionHref('faq'), label: 'FAQ' },
    ],
  },
  {
    title: 'Company',
    links: [{ href: 'mailto:arjun@zebri.com.au', label: 'Contact' }],
  },
  {
    title: 'Legal',
    links: [
      { href: 'https://zebri.com.au/privacy', label: 'Privacy' },
      { href: 'https://zebri.com.au/terms', label: 'Terms' },
    ],
  },
];

/**
 * PLACEHOLDER: Zebri's social accounts. The links go nowhere until the
 * handles are set up; put each real profile URL here before launch.
 */
const SOCIALS: { name: string; href: string; icon: ZebriIcon }[] = [
  { name: 'Instagram', href: '#', icon: InstagramIcon },
  { name: 'Facebook', href: '#', icon: FacebookIcon },
  { name: 'LinkedIn', href: '#', icon: LinkedinIcon },
];

/** The footer. */
export function SiteFooter() {
  return (
    <footer className="border-t border-hairline px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-16 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 space-y-4 md:col-span-1">
            <Image
              src="/zebri-logo-clear.svg"
              alt="Zebri"
              width={78}
              height={28}
              className="h-7 w-auto"
            />
            <p className="max-w-xs type-body text-zebra-500">
              Built for Australian wedding MCs and Celebrants.
            </p>
            {/* 40px targets, the footer links' own height on phones; the glyph stays quiet at 20px. */}
            <ul aria-label="Zebri on social media" className="-ml-2.5 flex items-center gap-1">
              {SOCIALS.map(({ name, href, icon: Icon }) => (
                <li key={name}>
                  <a
                    href={href}
                    aria-label={`Zebri on ${name}`}
                    className="flex size-10 items-center justify-center rounded-button text-zebra-500 transition-colors duration-150 hover:bg-hover hover:text-zebra-950 focus-mark"
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="type-label text-zebra-950">{col.title}</h3>
              <ul className="mt-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {/* 40px tall on phones, a thumb's target; 32px from sm. */}
                    <a
                      href={link.href}
                      className="inline-flex min-h-10 items-center rounded-check type-body text-zebra-500 hover:text-zebra-950 focus-mark sm:min-h-8"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-hairline py-6 type-body text-zebra-400 sm:flex-row sm:justify-between">
          {/* The brand only, no company name or ABN (founder, 2026-10-19). */}
          <p>© 2026 Zebri</p>
          <p>Built and hosted in Australia</p>
        </div>
      </div>
    </footer>
  );
}
