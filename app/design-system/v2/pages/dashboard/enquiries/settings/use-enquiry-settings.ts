import { useState, useSyncExternalStore } from 'react';


/**
 * The Enquiries settings tab's state for the preview: which inboxes and
 * Instagram are connected.
 * One store for the whole preview (like `home/run-sheet-store.ts`), so
 * the popover knows whether anything is set up (it says Set up until
 * then) and a connection survives moving between pages. Everything
 * starts off: a block just added has nothing feeding it yet. Connect is
 * simulated: a short busy beat, then connected. Nothing leaves the page
 * and nothing persists past a reload.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/settings/use-enquiry-settings
 */

// Long enough to read as a sign-in happening, short enough not to wait on.
const CONNECT_MS = 900;

interface Stored {
  connected: ReadonlySet<string>;
}

let state: Stored = {
  connected: new Set(),
};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => state;
const write = (next: Partial<Stored>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

/** At least one source feeds enquiries in: an inbox or Instagram. */
export const isConfigured = (s: Pick<Stored, 'connected'>) => s.connected.size > 0;

/** Whether any enquiry source is set up, kept current. */
export function useEnquiriesConfigured() {
  return isConfigured(useSyncExternalStore(subscribe, read, read));
}

/** The settings and what changes them. */
export function useEnquirySettings() {
  const s = useSyncExternalStore(subscribe, read, read);
  // Which account is mid sign-in; only the dialog that started it needs to know.
  const [connecting, setConnecting] = useState<string | null>(null);

  const connect = (id: string) => {
    setConnecting(id);
    window.setTimeout(() => {
      write({ connected: new Set([...state.connected, id]) });
      setConnecting(null);
    }, CONNECT_MS);
  };
  const disconnect = (id: string) => write({ connected: new Set([...state.connected].filter((x) => x !== id)) });

  return {
    ...s,
    connecting,
    connect,
    disconnect,
  };
}

/** What {@link useEnquirySettings} returns. */
export type EnquirySettings = ReturnType<typeof useEnquirySettings>;
