'use client';

import { ArrowUpDown, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';

import { Example, Rule, SampleFrame, Spec } from './showroom';

/**
 * Page-chrome patterns: the title row, the toolbar and the section nav.
 *
 * These are compositions rather than importable components. Copy the
 * markup and adapt it.
 *
 * @module app/design-system/patterns-chrome
 */

const NAV_ITEMS = ['Overview', 'Events', 'Contacts', 'Tasks'];

/** Page header, toolbar and section nav patterns. */
export function PatternsChrome() {
  const [active, setActive] = useState('Overview');
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <>
      <Spec name="Page header" description="Every dashboard page opens with this.">
        <Rule>
          Never hand-write a page title. <code>PageHeader</code> owns the type size, the responsive
          step down on mobile, and the baseline the count sits on.
        </Rule>
        <Example
          code={`<PageHeader\n  title="Couples"\n  count={couples.length}\n  className="mb-4"\n  actions={\n    <Button>\n      <Plus size={11} strokeWidth={1.5} />\n      New couple\n    </Button>\n  }\n/>`}
        >
          <SampleFrame>
            <PageHeader
              title="Couples"
              count={42}
              actions={
                <Button>
                  <Plus size={11} strokeWidth={1.5} />
                  New couple
                </Button>
              }
            />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="Toolbar" description="Search, filters and the primary action, above a list.">
        <Rule>
          Every control shares one 32px height, so a toolbar lines up with no effort. Filter and
          sort triggers are <code>variant=&quot;outline&quot;</code>; the primary action is the
          default variant and sits at <code>ml-auto</code>. Dropdowns use <code>MenuPanel</code>.
        </Rule>
        <Example
          code={`<div className="flex flex-wrap items-center gap-2">\n  <SearchField />\n  <Button variant="outline">\n    <SlidersHorizontal size={11} strokeWidth={1.5} />Filter\n  </Button>\n  <Button variant="outline">\n    <ArrowUpDown size={11} strokeWidth={1.5} />Sort\n  </Button>\n  <Button className="ml-auto">\n    <Plus size={11} strokeWidth={1.5} />New couple\n  </Button>\n</div>`}
        >
          <SampleFrame>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search
                  size={11}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle"
                />
                {/* Mirrors `Input`'s own classes; Input has no prefix slot yet. */}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search couples..."
                  className="block h-8 w-full rounded-control border border-border bg-surface pl-6 pr-6 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none"
                />
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setFilterOpen((o) => !o)}
                  className="whitespace-nowrap"
                >
                  <SlidersHorizontal size={11} strokeWidth={1.5} />
                  Filter
                </Button>
                {filterOpen ? (
                  <div className="absolute left-0 top-full z-20 mt-1">
                    <MenuPanel>
                      <MenuItem size="sm" selected onClick={() => setFilterOpen(false)}>
                        All
                      </MenuItem>
                      <MenuItem size="sm" onClick={() => setFilterOpen(false)}>
                        Booked
                      </MenuItem>
                      <MenuItem size="sm" onClick={() => setFilterOpen(false)}>
                        Enquiry
                      </MenuItem>
                    </MenuPanel>
                  </div>
                ) : null}
              </div>
              <Button variant="outline" className="whitespace-nowrap">
                <ArrowUpDown size={11} strokeWidth={1.5} />
                Sort
              </Button>
              <Button className="ml-auto">
                <Plus size={11} strokeWidth={1.5} />
                New couple
              </Button>
            </div>
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="Section nav" description="The 200px left rail inside Settings and the couple profile.">
        <Example
          code={`<nav className="w-[200px] space-y-0.5 border-r border-border px-3 py-4">\n  {items.map((item) => (\n    <button\n      key={item}\n      type="button"\n      onClick={() => setActive(item)}\n      className={\`flex w-full cursor-pointer items-center gap-3 rounded-control\n        px-3 py-2.5 text-body transition-colors \${\n          active === item\n            ? 'bg-surface-emphasis text-text'\n            : 'text-text-muted hover:bg-surface-emphasis'\n        }\`}\n    >\n      <span className="truncate">{item}</span>\n    </button>\n  ))}\n</nav>`}
        >
          <SampleFrame>
            <nav className="w-[200px] space-y-0.5 border-r border-border px-3 py-4">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActive(item)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-body transition-colors ${
                    active === item
                      ? 'bg-surface-emphasis text-text'
                      : 'text-text-muted hover:bg-surface-emphasis'
                  }`}
                >
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </nav>
          </SampleFrame>
        </Example>
      </Spec>
    </>
  );
}
