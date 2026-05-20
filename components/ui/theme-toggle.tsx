'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

/**
 * Light/dark theme toggle.
 *
 * Reads/writes `localStorage.zebri-theme` ('light' | 'dark') and toggles the
 * `dark` class on `<html>`. The synchronous bootstrap in `app/layout.tsx`
 * applies the initial theme before paint, so this component only handles
 * runtime changes (no FOUC concern here).
 *
 * Default OS preference is honoured until the user makes an explicit choice;
 * after that, the explicit choice wins (standard SaaS pattern).
 *
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 *
 * @module components/ui/theme-toggle
 */

type Theme = 'light' | 'dark';

/**
 * Subscribe to changes of the `dark` class on `<html>`. The current theme
 * lives in the DOM (set by `app/layout.tsx`'s bootstrap), not React state —
 * `useSyncExternalStore` reads/observes it without violating the "no
 * setState in effect" rule.
 */
function subscribeToHtmlClass(notify: () => void): () => void {
  const obs = new MutationObserver(notify);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getClientTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerTheme(): Theme {
  return 'light';
}

function applyTheme(next: Theme): void {
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem('zebri-theme', next);
  } catch {
    // localStorage can throw in private mode / sandboxed contexts.
  }
}

export interface ThemeToggleProps {
  /** Extra classes — prefer tokens (`text-text-muted`) over raw colours. */
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeToHtmlClass, getClientTheme, getServerTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      // applyTheme mutates the DOM class; the MutationObserver in
      // subscribeToHtmlClass re-snapshots and re-renders this component.
      onClick={() => applyTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center justify-center rounded-control p-2 text-text-muted transition-colors hover:bg-surface-emphasis hover:text-text${className ? ` ${className}` : ''}`}
    >
      <Icon width={18} height={18} aria-hidden="true" />
    </button>
  );
}
