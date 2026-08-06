'use client';

import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

import { Conflict } from './conflict';
import { Demo, SampleFrame, Spec } from './showroom';

/**
 * Page-chrome patterns: page headers, section navs and filter bars.
 *
 * These are not components. Each one is copy-pasted markup that recurs
 * across pages, reproduced here from the real source so the divergence
 * between call sites is visible.
 *
 * @module app/design-system/patterns-chrome
 */

/** Page-title treatments found in the app, with where each is used. */
const H1_VARIANTS = [
  { cls: 'text-3xl font-semibold text-gray-900', where: 'couples, tasks, contacts (6 pages)' },
  { cls: 'text-3xl font-semibold text-text', where: 'templates, automations (3 pages)' },
  { cls: 'text-2xl sm:text-3xl font-semibold text-text', where: 'branding' },
  { cls: 'text-xl font-semibold text-gray-900', where: 'auth pages' },
  { cls: 'text-display font-semibold text-text', where: 'one page only' },
];

/** Page header, section nav and filter-bar patterns. */
export function PatternsChrome() {
  return (
    <>
      <Spec name="Page header" description="Title, count and actions. Every dashboard page builds this by hand.">
        <SampleFrame>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-semibold text-gray-900">Couples</h2>
              <span className="text-sm text-gray-400">42 total</span>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white transition hover:bg-gray-700"
              aria-label="Add couple"
            >
              +
            </button>
          </div>
        </SampleFrame>
      </Spec>

      <Conflict
        title="Page titles are declared twelve different ways. The five distinct looks:"
        recommendation={
          <>
            Extract a <code>&lt;PageHeader title count actions /&gt;</code> component using{' '}
            <code>text-display font-semibold text-text</code>. Right now the same visual role is
            written five different ways, and the round add button also violates the{' '}
            <code>rounded-xl</code>, never <code>rounded-full</code> rule.
          </>
        }
      >
        <div className="space-y-2">
          {H1_VARIANTS.map((v) => (
            <div key={v.cls} className="flex flex-wrap items-baseline gap-x-3">
              <span className={v.cls}>Couples</span>
              <code className="text-caption text-text-subtle">{v.cls}</code>
              <span className="text-caption text-text-subtle">· {v.where}</span>
            </div>
          ))}
        </div>
      </Conflict>

      <Spec name="Section nav" description="The 200px left rail used inside Settings and the couple profile.">
        <SampleFrame>
          <nav className="w-[200px] space-y-0.5 border-r border-gray-200 px-3 py-4">
            {['Overview', 'Events', 'Contacts', 'Tasks'].map((label, i) => (
              <button
                key={label}
                type="button"
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  i === 0 ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </SampleFrame>
      </Spec>

      <Conflict
        title="The section nav is implemented twice, near-identically"
        recommendation={
          <>
            <code>settings/settings-nav.tsx</code> and{' '}
            <code>couples/couple-profile-nav.tsx</code> both build the same 200px rail with the same
            mobile scroller, but their desktop rows use different type sizes and padding. Extract one{' '}
            <code>&lt;SectionNav /&gt;</code> and have both import it.
          </>
        }
      >
        <div className="space-y-3">
          <Demo label="settings-nav.tsx · px-3 py-2.5 · text-sm">
            <span className="inline-flex cursor-pointer items-center gap-3 rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-900">
              Overview
            </span>
          </Demo>
          <Demo label="couple-profile-nav.tsx · px-3 py-2 · text-xs">
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-900">
              Overview
            </span>
          </Demo>
        </div>
      </Conflict>

      <Spec name="Filter bar" description="Search, filter and sort controls above a list. Hand-built on every list page.">
        <SampleFrame>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                size={12}
                strokeWidth={1.5}
              />
              <input
                placeholder="Search couples"
                className="w-full rounded-md border border-gray-200 py-2 pl-6 pr-6 text-xs text-gray-900 transition placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 px-2 py-2 text-xs transition hover:bg-gray-50"
            >
              <SlidersHorizontal size={12} strokeWidth={1.5} /> Filters
            </button>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 px-2 py-2 text-xs text-gray-500 transition hover:bg-gray-50"
            >
              Sort <ChevronDown size={12} strokeWidth={1.5} />
            </button>
          </div>
        </SampleFrame>
      </Spec>

      <Conflict
        title="Filter-bar controls are 32px tall with rounded-md; the primitives are 36px with rounded-control"
        recommendation={
          <>
            The filter bar builds its own search field and dropdown triggers with{' '}
            <code>text-xs</code> and <code>py-2</code>, so it sits a few pixels off any{' '}
            <code>Input size=&quot;sm&quot;</code> or <code>Select size=&quot;sm&quot;</code> placed
            beside it. Rebuild the bar on the primitives, or add a matching{' '}
            <code>xs</code> size to them.
          </>
        }
      />
    </>
  );
}
