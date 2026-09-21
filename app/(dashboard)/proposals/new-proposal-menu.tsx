/**
 * The one "New" button on `/proposals`: a proposal or a template were two
 * separate primary buttons before this, which crowded the header for an
 * action the MC reaches for far less often than "New proposal". One
 * button, two ways behind it, same split-button pattern as Workflows'
 * `new-workflow-menu.tsx`.
 *
 * @module app/(dashboard)/proposals/new-proposal-menu
 */
'use client';

import { ChevronDown, FileHeart, FileText, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { isChromePress } from '@/components/ui/use-overlay';

export interface NewProposalMenuProps {
  /** Opens the proposal builder. */
  onNewProposal: () => void;
  /**
   * Opens the New template flow (Start from scratch / Use a starter).
   * Omitted while Proposal Layout v2 is off: renders a plain "New
   * proposal" button with no dropdown, since the template feature
   * behind it doesn't exist yet.
   */
  onNewTemplate?: () => void;
}

/** The New split button. See {@link NewProposalMenuProps}. */
export function NewProposalMenu({ onNewProposal, onNewTemplate }: NewProposalMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node) && !isChromePress(event.target)) {
        setOpen(false);
      }
    };
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

  if (!onNewTemplate) {
    return (
      <Button onClick={onNewProposal} className="gap-1.5" aria-label="New proposal">
        <Plus size={16} strokeWidth={1.5} />
        <span className="hidden sm:inline" aria-hidden="true">New proposal</span>
      </Button>
    );
  }

  const pick = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Button onClick={() => setOpen((wasOpen) => !wasOpen)} className="gap-1.5">
        <Plus size={16} strokeWidth={1.5} />
        <span className="hidden sm:inline">New</span>
        <ChevronDown size={14} strokeWidth={1.5} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1">
          <MenuPanel>
            <MenuItem size="sm" onClick={() => pick(onNewProposal)}>
              <span className="flex items-center gap-2">
                <FileHeart size={16} strokeWidth={1.5} />
                New proposal
              </span>
            </MenuItem>
            <MenuItem size="sm" onClick={() => pick(onNewTemplate)}>
              <span className="flex items-center gap-2">
                <FileText size={16} strokeWidth={1.5} />
                New template
              </span>
            </MenuItem>
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}
