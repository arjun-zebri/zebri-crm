'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowUpIcon, AttachIcon, ChevronDownIcon, ClientsIcon, MicIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { PromptBox } from '@/components/ui-v2/prompt-box';

import { DEFAULT_QUICK_STARTS, QUICK_STARTS, type QuickStartId } from './briefing';
import { SCOPES } from './demo-data';

/**
 * The dashboard's "Ask Zebri" composer: the prompt box, a client scope
 * picker, attach and voice/send, plus quick starts under it (see
 * `briefing.ts`), each of which opens its own dialog.
 * Nothing is sent in the preview.
 *
 * @module app/design-system/v2/pages/dashboard/ask-zebri
 */

export interface AskZebriProps {
  /** Opens the quick start picked. */
  onQuickStart: (id: QuickStartId) => void;
  /**
   * Which quick starts show, in this order; the business's three
   * (proposal, invoice, run sheet) by default. A new account passes its
   * own: a trick, a client, a proposal.
   */
  quickStarts?: QuickStartId[] | undefined;
  /** The client scope picker; off for an account with no clients to scope to. */
  scoped?: boolean | undefined;
}

/** The composer and quick starts. See {@link AskZebriProps}. */
export function AskZebri({ onQuickStart, quickStarts, scoped = true }: AskZebriProps) {
  const starts = (quickStarts ?? DEFAULT_QUICK_STARTS).flatMap((id) => QUICK_STARTS.filter((q) => q.id === id));
  const [text, setText] = useState('');
  const [scope, setScope] = useState(SCOPES[0] ?? 'All clients');
  const hasText = text.trim().length > 0;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-3">
      <PromptBox
        label="Ask Zebri"
        placeholder="Ask Zebri anything"
        value={text}
        onChange={setText}
        onSubmit={() => setText('')}
        inputRef={inputRef}
        tools={scoped ? <ScopePicker value={scope} onChange={setScope} /> : undefined}
        actions={
          <>
            <Button variant="ghost" square aria-label="Attach a file">
              <AttachIcon aria-hidden="true" className="size-4" />
            </Button>
            {/* One slot, two jobs: a quiet mic while empty, the green Send
                once there is text, so the toolbar never changes width and
                the page's strongest colour only appears when it is useful. */}
            <Button type={hasText ? 'submit' : 'button'} variant={hasText ? 'primary' : 'ghost'} square aria-label={hasText ? 'Send' : 'Dictate'}>
              {hasText ? (
                <ArrowUpIcon aria-hidden="true" className="size-4" />
              ) : (
                <MicIcon aria-hidden="true" className="size-4" />
              )}
            </Button>
          </>
        }
      />
      {starts.length ? (
      <div className="flex flex-wrap justify-center gap-1">
        {starts.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant="ghost" aria-haspopup="dialog" onClick={() => onQuickStart(id)} icon={<Icon aria-hidden="true" className="size-4 text-zebra-400" />}>
            {label}
          </Button>
        ))}
      </div>
      ) : null}
    </div>
  );
}

/** Which client the question is about. A popover list with a check on the pick. */
function ScopePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Ghost, not secondary: inside the prompt panel a bordered button
          is a box in a box and outweighs the text field it serves. */}
      <PopoverTrigger asChild>
        <Button variant="ghost" aria-label={`Scope: ${value}`} icon={<ClientsIcon aria-hidden="true" className="size-4 text-zebra-500" />}>
          <span className="max-w-40 truncate">{value}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4 text-zebra-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label="Scope">
        {SCOPES.map((s) => (
          <MenuOption
            key={s}
            selected={s === value}
            onSelect={() => {
              onChange(s);
              setOpen(false);
            }}
          >
            {s}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
