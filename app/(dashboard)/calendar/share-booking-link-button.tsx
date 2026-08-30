'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { isChromePress } from '@/components/ui/use-overlay';
import { buildHostedUrl } from '@/lib/booking/snippets';

import { useMeetingTypes } from './use-meeting-types';

/** The booking page URL for a share token, resolved against this origin. */
function hostedUrl(token: string): string {
  return buildHostedUrl(typeof window === 'undefined' ? '' : window.location.origin, token);
}

/**
 * Header action that puts a booking link on the clipboard.
 *
 * With one active meeting type there is nothing to choose, so the button
 * copies straight away. With several, picking which link to send is the whole
 * question, so it opens a menu of them instead of guessing.
 *
 * @module app/(dashboard)/calendar/share-booking-link-button
 */
export function ShareBookingLinkButton() {
  const { data: meetingTypes } = useMeetingTypes();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node) && !isChromePress(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const active = (meetingTypes ?? []).filter((type) => type.active);

  if (active.length === 0) {
    return (
      <Button variant="outline" disabled title="Create a meeting type first">
        Share booking link
      </Button>
    );
  }

  if (active.length === 1) {
    const only = active[0]!;
    return (
      <CopyButton
        value={() => hostedUrl(only.share_token)}
        label="Share booking link"
        copiedLabel="Link copied"
        variant="outline"
      />
    );
  }

  const copy = async (token: string, name: string) => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(hostedUrl(token));
      toast(`${name} link copied`);
    } catch {
      // Clipboard is unavailable outside a secure context or when the user
      // denied permission. The link is still reachable from Meeting types.
      toast('Could not copy the link');
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Button variant="outline" onClick={() => setOpen((wasOpen) => !wasOpen)}>
        Share booking link
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1">
          <MenuPanel>
            {active.map((type) => (
              <MenuItem key={type.id} size="sm" onClick={() => copy(type.share_token, type.name)}>
                {type.name}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}
