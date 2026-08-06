/**
 * Tab navigation for the Couple Profile overlay (modal).
 *
 * Two renderings driven by the same `navItems` array:
 * - Mobile (≤ sm): a horizontal scrollable pill row pinned under
 *   the header.
 * - Desktop: a vertical sidebar nav on the left of the body.
 *
 * In "settings mode" (the header gear) the SAME desktop rows are reused —
 * identical classes, so the row height/shape is unchanged — with a drag
 * handle on the left and an eye / eye-off toggle on the right. The full tab
 * set (including hidden ones, greyed) is shown so they can be re-revealed and
 * reordered. Reordering uses `@hello-pangea/dnd` (the same engine as the
 * couples Kanban) so the drag feels identical: instant pickup, whole row is
 * the handle.
 *
 * Stateless — the parent owns `activeSection`, the nav-item lists, and the
 * draft layout. This component just renders the chrome.
 *
 * @module app/(dashboard)/couples/couple-profile-nav
 */
'use client';

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableStateSnapshot,
  type DraggingStyle,
  type DropResult,
  type NotDraggingStyle,
} from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical } from 'lucide-react';

import type {
  CoupleProfileSection,
  CoupleProfileNavItem,
  CoupleProfileTabsConfig,
} from './couple-profile-types';

export interface CoupleProfileNavProps {
  /** Visible tabs, in order (the normal nav). */
  navItems: CoupleProfileNavItem[];
  activeSection: CoupleProfileSection;
  onSectionChange: (section: CoupleProfileSection) => void;
  /** When true, the desktop/mobile nav becomes the reorder + hide editor. */
  settingsMode: boolean;
  /** Full tab set in configured order (settings mode renders all of these). */
  settingsItems: CoupleProfileNavItem[];
  draftConfig: CoupleProfileTabsConfig;
  onDraftChange: (next: CoupleProfileTabsConfig) => void;
}

/** Shared row classes — identical for the live nav and the settings rows. */
const ROW =
  'w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-body transition';

/** Snappy drop: collapse the drop animation so the row lands instantly. */
function dragStyle(
  style: DraggingStyle | NotDraggingStyle | undefined,
  snapshot: DraggableStateSnapshot,
) {
  if (style && snapshot.isDropAnimating) {
    return { ...style, transitionDuration: '0.001s' };
  }
  return style;
}

export function CoupleProfileNav({
  navItems,
  activeSection,
  onSectionChange,
  settingsMode,
  settingsItems,
  draftConfig,
  onDraftChange,
}: CoupleProfileNavProps) {
  const hidden = new Set(draftConfig.hidden_tabs);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    const ids = settingsItems.map((i) => i.key);
    const [moved] = ids.splice(source.index, 1);
    if (!moved) return;
    ids.splice(destination.index, 0, moved);
    onDraftChange({ ...draftConfig, tab_order: ids });
  };

  const toggleHidden = (key: CoupleProfileSection) => {
    const next = hidden.has(key)
      ? draftConfig.hidden_tabs.filter((k) => k !== key)
      : [...draftConfig.hidden_tabs, key];
    onDraftChange({ ...draftConfig, hidden_tabs: next });
  };

  // Settings mode: one vertical drag-to-reorder list reusing the normal row
  // metrics. Same container as the desktop sidebar on sm+; a bordered block on
  // mobile.
  if (settingsMode) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="couple-profile-tabs">
          {(dropProvided) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className="shrink-0 overflow-y-auto border-b border-border px-3 py-2 space-y-0.5 animate-fade-in sm:w-[200px] sm:border-b-0 sm:border-r sm:py-4"
            >
              {settingsItems.map((item, index) => {
                const isHidden = hidden.has(item.key);
                const locked = item.key === 'overview';
                return (
                  <Draggable key={item.key} draggableId={item.key} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={dragStyle(dragProvided.draggableProps.style, snapshot)}
                        className={`${ROW} cursor-grab select-none active:cursor-grabbing ${
                          snapshot.isDragging ? 'bg-surface shadow-lg' : 'hover:bg-surface-emphasis'
                        } ${isHidden ? 'text-text-subtle' : 'text-text'}`}
                      >
                        <GripVertical
                          size={16}
                          strokeWidth={1.5}
                          className="-ml-1 shrink-0 text-gray-300"
                        />
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleHidden(item.key)}
                          disabled={locked}
                          aria-label={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                          title={
                            locked
                              ? 'Overview is always shown'
                              : isHidden
                                ? 'Show tab'
                                : 'Hide tab'
                          }
                          className={`-mr-1 shrink-0 rounded-control p-0.5 transition ${
                            locked
                              ? 'cursor-not-allowed text-gray-300'
                              : 'cursor-pointer text-text-subtle hover:text-gray-700'
                          }`}
                        >
                          {isHidden ? (
                            <EyeOff size={16} strokeWidth={1.5} />
                          ) : (
                            <Eye size={16} strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="sm:hidden shrink-0 border-b border-border overflow-x-auto">
        <div className="flex px-2 py-2 gap-1 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-control text-caption whitespace-nowrap transition cursor-pointer ${
                activeSection === item.key
                  ? 'bg-surface-emphasis text-text font-medium'
                  : 'text-text-muted'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:block w-[200px] shrink-0 border-r border-border overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onSectionChange(item.key)}
            className={`${ROW} cursor-pointer ${
              activeSection === item.key
                ? 'bg-surface-emphasis text-text font-medium'
                : 'text-text-muted hover:text-gray-700 hover:bg-surface-emphasis'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
