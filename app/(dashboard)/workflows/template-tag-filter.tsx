'use client';

/**
 * Tag filter and tag management, in one dropdown.
 *
 * Chips laid out along the toolbar grew with the tag list and pushed
 * the search box and the primary button around; an MC with eight tags
 * had a toolbar that wrapped onto two lines before they had done
 * anything. A single control that reads back what it is filtering by
 * costs one click and never changes size.
 *
 * Multi-select: picking two tags shows templates carrying either, which
 * is what an MC scanning for "enquiry or package" work expects.
 *
 * @module app/(dashboard)/workflows/template-tag-filter
 */

import { ChevronDown, Tags } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel, MenuSeparator } from '@/components/ui/menu';
import { isChromePress } from '@/components/ui/use-overlay';
import { TAG_PILL_CLASS, toTagColor } from '@/types/workflows';

export interface TemplateTagFilterProps {
  tags: { id: string; name: string; color: string }[];
  /** Currently selected tag ids. Empty means no filtering. */
  selected: string[];
  onChange: (next: string[]) => void;
  onManageTags: () => void;
}

/** The tag dropdown. See {@link TemplateTagFilterProps}. */
export function TemplateTagFilter({
  tags,
  selected,
  onChange,
  onManageTags,
}: TemplateTagFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node) && !isChromePress(event.target)) {
        setOpen(false);
      }
    };
    // Escape closes it too: a dropdown opened by mistake should not
    // need the MC to aim at the page to get rid of it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle(tagId: string) {
    onChange(
      selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId],
    );
  }

  const label =
    selected.length === 0
      ? 'All tags'
      : selected.length === 1
        ? (tags.find((t) => t.id === selected[0])?.name ?? '1 tag')
        : `${selected.length} tags`;

  return (
    <div className="relative" ref={wrapperRef}>
      <Button variant="outline" onClick={() => setOpen((wasOpen) => !wasOpen)}>
        <Tags size={16} strokeWidth={1.5} />
        {label}
        <ChevronDown size={16} strokeWidth={1.5} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1">
          <MenuPanel className="max-h-96 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="px-3 py-2 text-body text-text-muted">
                No tags yet. Make one to group your workflows.
              </p>
            ) : (
              tags.map((tag) => (
                <MenuItem
                  key={tag.id}
                  size="sm"
                  checked={selected.includes(tag.id)}
                  onClick={() => toggle(tag.id)}
                  trailing={
                    <span
                      className={`rounded-pill px-2 py-0.5 text-body ring-1 ring-inset ${TAG_PILL_CLASS[toTagColor(tag.color)]}`}
                    >
                      &nbsp;
                    </span>
                  }
                >
                  {tag.name}
                </MenuItem>
              ))
            )}

            <MenuSeparator />
            {selected.length > 0 ? (
              <MenuItem size="sm" onClick={() => onChange([])}>
                Show every workflow
              </MenuItem>
            ) : null}
            <MenuItem
              size="sm"
              onClick={() => {
                setOpen(false);
                onManageTags();
              }}
            >
              Manage tags
            </MenuItem>
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}
