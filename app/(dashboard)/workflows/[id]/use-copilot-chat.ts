/**
 * Client hook driving the Zebri AI copilot conversation.
 *
 * Holds the ephemeral chat (lost on reload — by design), POSTs to the
 * copilot route, parses the SSE stream via `createSseParser`, and
 * fires `onWorkflowChanged` whenever a tool mutates the automation so
 * the canvas can refetch.
 *
 * @module app/(dashboard)/workflows/[id]/use-copilot-chat
 */
import { useCallback, useRef, useState } from 'react';

import type { CopilotRequest } from '@/lib/workflows/ai-copilot/request';
import { createSseParser } from '@/lib/workflows/ai-copilot/stream';

/** One rendered row in the conversation. */
export interface CopilotChatEntry {
  id: string;
  kind: 'user' | 'assistant' | 'error';
  text: string;
}

/** The copilot route. Asserted against the filesystem in the unit tests. */
export const COPILOT_ENDPOINT = '/api/ai/workflow-copilot';

/**
 * The request body, built through the route's own type.
 *
 * Typed as {@link CopilotRequest} rather than assembled inline so the
 * two halves of the wire cannot drift again: this file used to send
 * `templateId` while the route parsed `automationId`, and every message
 * came back "Invalid request body". The unit test runs what this
 * returns through the route's schema.
 */
export function buildCopilotRequest(
  templateId: string,
  messages: CopilotRequest['messages'],
): CopilotRequest {
  return { templateId, messages };
}

/** Hard bound on the client-held conversation; a reload starts over. */
const MAX_ENTRIES = 60;

const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  read_automation: 'Reading the automation',
  set_trigger: 'Setting the trigger',
  add_action: 'Adding a step',
  update_action_config: 'Updating a step',
  remove_action: 'Removing a step',
};

export function useCopilotChat({
  templateId,
  onWorkflowChanged,
}: {
  templateId: string;
  onWorkflowChanged: () => void;
}) {
  const [entries, setEntries] = useState<CopilotChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  // Transient tool status ("Setting the trigger"): one line, replaced
  // in place per tool, cleared when the tool (and the turn) finishes.
  const [activity, setActivity] = useState<string | null>(null);
  const nextId = useRef(0);

  const push = useCallback((kind: CopilotChatEntry['kind'], text: string) => {
    // Capture the id NOW — several events often arrive in one stream
    // chunk, so these updaters run batched; reading the ref inside the
    // updater would give every batched entry the same (final) id.
    nextId.current += 1;
    const id = `e${nextId.current}`;
    setEntries((prev) => [...prev, { id, kind, text }]);
  }, []);

  const capped = entries.length >= MAX_ENTRIES;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || capped) return;
      setBusy(true);
      // History = spoken turns only; tool activity is display-side.
      // Bounded to the recent window — the server injects the current
      // automation state, so old turns rarely carry needed context.
      const history: CopilotRequest['messages'] = entries
        .filter((e) => e.kind === 'user' || e.kind === 'assistant')
        .slice(-9)
        .map((e) => ({
          role: e.kind === 'user' ? ('user' as const) : ('assistant' as const),
          content: e.text,
        }));
      push('user', trimmed);
      try {
        // Must match the route's own directory,
        // `app/api/ai/workflow-copilot/route.ts`. It was left pointing at
        // the pre-rename `automation-copilot` path, which 404s, and a
        // 404 is `!res.ok`, so every send died as "Something went
        // wrong". The integration test could not catch it: it imports
        // `POST` and calls it directly, so it never routes a URL.
        const res = await fetch(COPILOT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildCopilotRequest(templateId, [...history, { role: 'user', content: trimmed }]),
          ),
        });
        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          push('error', payload?.error ?? 'Something went wrong. Please try again.');
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser();
        let mutated = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            const e = event as Record<string, unknown>;
            if (e.type === 'message' && typeof e.text === 'string') {
              push('assistant', e.text);
            } else if (e.type === 'tool_call' && typeof e.tool === 'string') {
              setActivity(TOOL_ACTIVITY_LABELS[e.tool] ?? 'Working');
            } else if (e.type === 'tool_result') {
              setActivity(null);
              if (e.ok) {
                if (e.tool !== 'read_automation') {
                  mutated = true;
                  onWorkflowChanged();
                }
              } else if (typeof e.error === 'string') {
                push('error', e.error);
              }
            } else if (e.type === 'error' && typeof e.message === 'string') {
              push('error', e.message);
            }
          }
        }
        // Belt-and-braces: one final refetch after the stream closes so
        // the canvas never lags the last mutation.
        if (mutated) onWorkflowChanged();
      } catch {
        push('error', 'Connection lost. Please try again.');
      } finally {
        setBusy(false);
        setActivity(null);
      }
    },
    [templateId, busy, capped, entries, onWorkflowChanged, push],
  );

  return { entries, busy, capped, activity, send };
}
