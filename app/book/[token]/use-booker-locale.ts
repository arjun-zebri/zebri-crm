/**
 * The locale every time on the booking page is formatted with.
 *
 * Read through `useSyncExternalStore` so the server render and the first
 * client render both use the fallback, and the booker's own `navigator.language`
 * takes over on the client. Times only appear after the slots have loaded on
 * the client, so the switch never reflows text that was already visible.
 *
 * @module app/book/[token]/use-booker-locale
 */
'use client'

import { useSyncExternalStore } from 'react'

import { FALLBACK_LOCALE, pickLocale } from '@/lib/booking/format-time'

/** The language never changes during a visit, so there is nothing to subscribe to. */
const subscribe = () => () => {};

/** The booker's locale, or `en-AU` until the browser has said. */
export function useBookerLocale(): string {
  return useSyncExternalStore(
    subscribe,
    () => pickLocale(navigator.language),
    () => FALLBACK_LOCALE,
  );
}
