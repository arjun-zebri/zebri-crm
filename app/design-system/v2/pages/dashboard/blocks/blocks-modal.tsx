'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { BlocksIcon, CloseIcon, SearchIcon } from '@/components/ui-v2/icons';

import { openSettings } from '../settings/settings-store';

import { BlockDetail } from './block-detail';
import { BlockList } from './block-list';
import { BlocksRail, type View } from './blocks-rail';
import { CATALOG, CATEGORIES, CATEGORY_LINES, type Block, type Category } from './catalog';
import type { BlocksState } from './use-blocks';

/**
 * Blocks: everything Zebri can do, so an MC adds what they use and the
 * rest stays out of their sidebar. Two panes: a slim rail (title,
 * search, views) beside one column of rows, grouped in the order a
 * client moves through (Win clients, Book and get paid, Plan the event,
 * then Run your business), each group headed by its name (`type-label`)
 * and one muted line of what it is for (founder's mockup, 2026-10-09). No recommendation on top: twelve blocks in a clear order need
 * no curating, and a suggested set read as an upsell. A row opens
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
  /** Open or Show me on an added block: the page takes the MC to it. Left out, Blocks just closes. */
  onLaunch?: ((block: Block) => void) | undefined;
}

const isCategory = (v: View): v is Category => (CATEGORIES as readonly string[]).includes(v);

/** The Blocks dialog. See {@link BlocksModalProps}. */
export function BlocksModal({ open, onClose, blocks, onLaunch }: BlocksModalProps) {
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
      (view === 'All' || (view === 'Added' ? blocks.added.has(b.id) : b.category === view)) &&
      (!q || `${b.name} ${b.pitch}`.toLowerCase().includes(q)),
  );
  // All is grouped by category; any other view is one group under its own name.
  const groups: { label: string; line: string | null; items: Block[] }[] =
    view === 'All'
      ? CATEGORIES.map((c) => ({
          label: c,
          line: CATEGORY_LINES[c],
          items: shown.filter((b) => b.category === c),
        }))
      : [{ label: view, line: isCategory(view) ? CATEGORY_LINES[view] : null, items: shown }];

  return (
    <Dialog open={open} onClose={close} size="lg" aria-labelledby="blocks-title">
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {/* 12px in at every size, so the X glyph is 22px from the top and right (Settings' padding, 2026-10-15). */}
        <span className="absolute right-3 top-3 z-10">
          <Button variant="ghost" square aria-label="Close" onClick={close}>
            <CloseIcon aria-hidden="true" className="size-4" />
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
          <div
            ref={list}
            hidden={detail !== null}
            className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5 md:px-12 md:pt-12"
          >
            {/* Keyed by view and by each return from a detail, so the list
                eases in (a 6px rise) instead of appearing all at once. The
                scroll box itself stays mounted, so its position is kept. */}
            <div
              key={`${view}-${epoch}`}
              className="space-y-12 motion-safe:animate-rise-in"
            >
              {shown.length === 0 ? (
                q ? (
                  <EmptyState compact icon={SearchIcon} title="Nothing matches" body={`No block matches “${query.trim()}”.`} />
                ) : (
                  <EmptyState compact icon={BlocksIcon} title="Nothing added yet" body="Blocks you add show here and in your sidebar." />
                )
              ) : (
                groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <section key={g.label} aria-label={g.label}>
                      {/* Each group headed like a page section: its name, and one line of what it is for. */}
                      <header className="pb-3">
                        <h3 className="type-label text-zebra-950">{g.label}</h3>
                        {g.line ? <p className="type-body text-zebra-500">{g.line}</p> : null}
                      </header>
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
              className="flex min-h-0 flex-1 flex-col motion-safe:animate-rise-in"
            >
              <BlockDetail
                block={detail}
                blocks={blocks}
                crumb={view}
                bodyRef={focusOnMount}
                onOpenBlock={setDetail}
                onLaunch={() => (close(), onLaunch?.(detail))}
                onSetUp={(tab) => (close(), openSettings(tab))}
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
