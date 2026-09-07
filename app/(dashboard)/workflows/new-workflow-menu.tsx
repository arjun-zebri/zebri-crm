'use client';

/**
 * The one way to start a workflow.
 *
 * There used to be three buttons on the toolbar and the same three
 * repeated in the empty state, which is both noisy and a decision the
 * MC has to make before they know what the three words mean. One
 * primary button, two ways behind it, in the order most people want
 * them.
 *
 * The third way, a chooser full of ready-made workflows, is gone. A
 * library of processes written for a generic MC is not a head start:
 * every one of them had to be read, understood and then rewritten
 * before it fitted anybody's actual business, which is more work than
 * describing the process once and letting Zebri draft it.
 *
 * @module app/(dashboard)/workflows/new-workflow-menu
 */

import { ChevronDown, Pencil, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { isChromePress } from '@/components/ui/use-overlay';

export interface NewWorkflowMenuProps {
  /** Blank canvas. */
  onBuildMyself: () => void;
  /** Opens "describe your process". */
  onGenerate: () => void;
  /** Spinner on the button while a blank workflow is being created. */
  busy?: boolean;
}

/** The New workflow split button. See {@link NewWorkflowMenuProps}. */
export function NewWorkflowMenu({ onBuildMyself, onGenerate, busy }: NewWorkflowMenuProps) {
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

  const pick = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Button onClick={() => setOpen((wasOpen) => !wasOpen)} loading={busy ?? false}>
        New workflow
        <ChevronDown size={16} strokeWidth={1.5} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1">
          <MenuPanel>
            <MenuItem size="sm" onClick={() => pick(onBuildMyself)}>
              <span className="flex items-center gap-2">
                <Pencil size={16} strokeWidth={1.5} />
                Build it myself
              </span>
            </MenuItem>
            <MenuItem size="sm" onClick={() => pick(onGenerate)}>
              <span className="flex items-center gap-2">
                <Sparkles size={16} strokeWidth={1.5} />
                Generate with Zebri AI
              </span>
            </MenuItem>
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}
