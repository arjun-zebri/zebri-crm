'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { BlockDetail } from './block-detail';
import { BlockList } from './block-list';
import { BlocksRail, type View } from './blocks-rail';
import { CATALOG, CATEGORIES, type Block, type Role } from './catalog';
import { FeaturedBundle } from './featured-bundle';
import type { BlocksState } from './use-blocks';

/**
 * Blocks: every Zebri tool and integration, so an MC adds what they use
 * and the rest stays out of their sidebar. Two panes: a slim rail
 * (title, search, views) beside one column of rows. All leads with one
 * suggestion for the MC's role (which also picks the role). A row opens
 * its detail in the list's place; Back returns to the list where it was
 * (the list stays mounted, hidden, so its scroll is kept).
 *
 * Kept deliberately sparse. Rejected as cluttered: a wide rail with
 * counts, a role dropdown and a plan card; two-column rows with "Pairs
 * with" lines; a large bundle card. A single column with no rail was
 * also tried and rejected: the rail stays.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/blocks-modal
 */

export interface BlocksModalProps {
  open: boolean;
  onClose: () => void;
  blocks: BlocksState;
}

/** The Blocks dialog. See {@link BlocksModalProps}. */
export function BlocksModal({ open, onClose, blocks }: BlocksModalProps) {
  const [role, setRole] = useState<Role>('MC');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('All');
  const [detail, setDetail] = useState<Block | null>(null);
  // Bumped on each return from a detail, to replay the list's ease-in.
  const [epoch, setEpoch] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const back = useRef<string | null>(null);
  // Stable, so it runs once per mounted detail rather than on every render
  // (an inline ref would pull focus back to the body after each Add).
  const focusOnMount = useCallback((el: HTMLDivElement | null) => el?.focus(), []);

  // Back from a detail: focus the row it came from, not the dialog's top.
  useEffect(() => {
    if (detail || !back.current) return;
    list.current?.querySelector<HTMLButtonElement>(`[data-open="${back.current}"]`)?.focus();
    back.current = null;
  }, [detail]);

  function close() {
    onClose();
    setDetail(null);
    setQuery('');
    setView('All');
  }
  function pickView(v: View) {
    setView(v);
    setDetail(null);
  }

  const q = query.trim().toLowerCase();
  const shown = CATALOG.filter(
    (b) =>
      (!b.for || b.for.includes(role)) &&
      (view === 'All' || (view === 'Added' ? blocks.added.has(b.id) : b.category === view)) &&
      (!q || `${b.name} ${b.pitch}`.toLowerCase().includes(q)),
  );
  // All is grouped by category under a quiet label; any other view is one list.
  const groups =
    view === 'All'
      ? CATEGORIES.map((c) => ({
          label: c as string,
          items: shown.filter((b) => b.category === c),
        }))
      : [{ label: '', items: shown }];

  return (
    <Dialog open={open} onClose={close} size="lg" aria-labelledby="blocks-title">
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <span className="absolute right-3 top-3 z-10 md:right-4">
          <Button variant="ghost" square aria-label="Close" onClick={close}>
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </span>
        <BlocksRail
          query={query}
          onQuery={setQuery}
          view={view}
          onView={pickView}
          blocks={blocks}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            hidden={detail !== null}
            className="hidden h-14 shrink-0 items-center px-6 md:flex"
          >
            <h3 className="type-subheading text-zebra-950">{view}</h3>
          </header>
          <div
            ref={list}
            hidden={detail !== null}
            className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5 md:px-6 md:pt-1"
          >
            {/* Keyed by view and by each return from a detail, so the list
                eases in (a 6px rise) instead of appearing all at once. The
                scroll box itself stays mounted, so its position is kept. */}
            <div
              key={`${view}-${epoch}`}
              className="space-y-6 motion-safe:animate-[rise-in_320ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
            >
              {view === 'All' && !q ? (
                <FeaturedBundle role={role} onRole={setRole} blocks={blocks} onOpen={setDetail} />
              ) : null}
              {shown.length === 0 ? (
                <p className="py-16 text-center type-body text-zebra-500">
                  {q ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : 'Nothing added yet.'}
                </p>
              ) : (
                groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <section key={g.label || view} aria-label={g.label || view}>
                      {g.label ? (
                        <h3 className="pb-1 type-body text-zebra-400">{g.label}</h3>
                      ) : null}
                      <BlockList items={g.items} blocks={blocks} onOpen={setDetail} />
                    </section>
                  ))
              )}
            </div>
          </div>

          {detail ? (
            // Keyed so each block mounts fresh and eases in.
            <div
              key={detail.id}
              className="flex min-h-0 flex-1 flex-col motion-safe:animate-[rise-in_320ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
            >
              <BlockDetail
                block={detail}
                blocks={blocks}
                crumb={view}
                bodyRef={focusOnMount}
                onOpenBlock={setDetail}
                onLaunch={close}
                onBack={() => {
                  back.current = detail.id;
                  setDetail(null);
                  setEpoch((e) => e + 1);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
