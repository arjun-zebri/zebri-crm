'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowUpIcon, ChatIcon, CloseIcon, MessageIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { Call } from './calls-data';
import type { Profile } from './profile-data';

/**
 * Asking Zebri about one client, tucked behind a round button at the
 * bottom right of every section of their profile until the MC wants it (2026-10-09 founder
 * mockup, "Chat as a popover"). Open, it offers three questions, then a
 * message field; answers stack above the suggestions. The preview
 * answers from the client's own data passed in `answers`; anything typed
 * gets a short holding reply, since nothing is sent in the preview.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-chat
 */

/** One question Zebri offers, with the answer it gives in the preview. */
export interface ChatSuggestion {
  question: string;
  answer: string;
}

export interface ProfileChatProps {
  /** "Amelia & Jack". */
  who: string;
  suggestions: ChatSuggestion[];
}

/** What Zebri answers in the preview, from the client's own data. */
export function suggestionsFor(profile: Profile, calls: Call[]): ChatSuggestion[] {
  const open = profile.facts.filter((f) => f.tone);
  const first = profile.people[0]?.name.split(' ')[0] ?? 'them';
  const ask = open.find((f) => f.tone === 'danger');
  const last = calls.find((c) => c.notes);
  return [
    {
      question: "What's still outstanding?",
      answer: open.length
        ? open.map((f) => `${f.label}: ${f.value}`).join('\n')
        : 'Nothing outstanding. Everything is on track.',
    },
    {
      question: `Draft a message to ${first}`,
      answer: ask
        ? `Hi ${first},\n\nQuick one before the day: could you send me your ${ask.label.toLowerCase()} when you have a moment? The venue needs it to finalise things.\n\nThanks!`
        : `Hi ${first},\n\nJust checking in ahead of ${profile.event.date}. Let me know if anything has changed.\n\nThanks!`,
    },
    {
      question: 'Summarise our last call',
      answer: last?.notes?.summary ?? 'You have not had a call with them yet.',
    },
  ];
}

interface Turn {
  question: string;
  answer: string;
}

/** The chat button and its popover. See {@link ProfileChatProps}. */
export function ProfileChat({ who, suggestions }: ProfileChatProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = (question: string) => {
    const known = suggestions.find((s) => s.question === question);
    const answer =
      known?.answer ??
      `Zebri will answer questions like this about ${who} once it is connected. Try one of the suggestions for now.`;
    setTurns((t) => [...t, { question, answer }]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    ask(text.trim());
    setText('');
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          square
          round
          aria-label={open ? 'Close chat' : `Ask about ${who}`}
        >
          {open ? (
            <CloseIcon aria-hidden="true" className="size-4" />
          ) : (
            <ChatIcon aria-hidden="true" className="size-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent size="panel" side="top" align="end" aria-label={`Ask about ${who}`}>
        <div className="max-h-80 space-y-4 overflow-y-auto p-4 pb-2">
          {turns.map((t, i) => (
            <div key={i} className="space-y-1 type-body">
              <p className="type-label text-zebra-950">{t.question}</p>
              <p className="whitespace-pre-line text-zebra-700">{t.answer}</p>
            </div>
          ))}
          <p className="type-body text-zebra-500">Ask about {who}</p>
        </div>
        <div className="px-2 pb-2">
          {suggestions.map((s) => (
            <MenuOption key={s.question} onSelect={() => ask(s.question)}>
              {s.question}
            </MenuOption>
          ))}
        </div>
        <form onSubmit={submit} className="border-t border-hairline p-3">
          <Input
            icon={MessageIcon}
            label={`Ask about ${who}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            trailing={
              <Button variant="ghost" square type="submit" aria-label="Send">
                <ArrowUpIcon aria-hidden="true" className="size-4" />
              </Button>
            }
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}
