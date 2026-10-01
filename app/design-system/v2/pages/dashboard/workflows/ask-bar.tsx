'use client';

import { ArrowUp, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Panel } from '@/components/ui-v2/panel';

/**
 * A slim "Ask Zebri" bar pinned to the foot of the page, as on the
 * client profile. In the workflow builder it edits the workflow
 * ("add a nudge if the contract isn't signed in 3 days"). Zebri's reply
 * sits just above the bar with at most one action, the fix, so an
 * answer is never a dead end. Send takes the green only once there is
 * text, like the Home composer.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/ask-bar
 */

export interface AskReply {
  text: string;
  action?: { label: string; run: () => void } | undefined;
}

export interface AskBarProps {
  placeholder: string;
  /** Zebri is working on the last ask. */
  busy: boolean;
  reply: AskReply | null;
  onDismiss: () => void;
  onAsk: (text: string) => void;
}

/** The Ask bar. See {@link AskBarProps}. */
export function AskBar({ placeholder, busy, reply, onDismiss, onAsk }: AskBarProps) {
  const [text, setText] = useState('');
  const has = text.trim().length > 0;
  return (
    <div className="pointer-events-none sticky bottom-3 z-10 mx-auto w-full max-w-2xl space-y-2 pt-6">
      {reply ? (
        <Panel raised className="pointer-events-auto flex items-start gap-3 px-4 py-3 motion-safe:animate-rise-in" role="status">
          <p className="min-w-0 flex-1 type-body text-zebra-950">{reply.text}</p>
          {reply.action ? (
            <Button
              variant="secondary"
              onClick={() => {
                reply.action?.run();
                onDismiss();
              }}
            >
              {reply.action.label}
            </Button>
          ) : null}
          <Button variant="ghost" square aria-label="Dismiss" onClick={onDismiss}>
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </Panel>
      ) : null}
      <Panel raised className="pointer-events-auto">
        <form
          className="flex items-center gap-3 py-1.5 pl-4 pr-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!has || busy) return;
            onAsk(text.trim());
            setText('');
          }}
        >
          <Image src="/zebri-icon.svg" alt="" width={18} height={18} className="size-[1.125rem] shrink-0 mix-blend-multiply" />
          <InlineInput aria-label="Ask Zebri" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} className="flex-1 type-body" />
          <Button type="submit" variant={has ? 'primary' : 'ghost'} square loading={busy} disabled={!has && !busy} aria-label="Ask">
            <ArrowUp aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </form>
      </Panel>
    </div>
  );
}
