/**
 * Shared domain types for per-couple time tracking.
 *
 * `TimeEntry` is the app-facing shape, not the raw DB row: the Time tab
 * and the running pill both want the category *name* rather than a bare
 * id, so the server actions flatten the joined `time_categories(name)`
 * into `category_name` before returning.
 *
 * @module types/time-tracking
 */

/** One of the user's own work categories (plain text, no colour). */
export interface TimeCategory {
  id: string;
  name: string;
  position: number;
}

/** One work session against a couple. `ended_at === null` means running. */
export interface TimeEntry {
  id: string;
  couple_id: string;
  /** ISO 8601 instant. */
  started_at: string;
  /** ISO 8601 instant, or null while the timer runs. */
  ended_at: string | null;
  category_id: string | null;
  /** Flattened from the joined category row; null when uncategorised. */
  category_name: string | null;
  note: string | null;
  /** True when the 8h cap stopped this session rather than the user. */
  auto_stopped: boolean;
}

/**
 * The user's single running session, plus what the pill needs to render
 * it. `server_now` lets the client correct for clock skew: elapsed is
 * measured against the server's clock, not the device's.
 */
export interface RunningTimer {
  entry: TimeEntry;
  couple_name: string;
  /** ISO 8601 instant, the server's clock at read time. */
  server_now: string;
}

/** A finished session paired with the couple it belongs to. */
export interface StoppedSession {
  entry: TimeEntry;
  couple_name: string;
}
