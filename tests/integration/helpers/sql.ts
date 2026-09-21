/**
 * Raw SQL against the LOCAL Supabase database, for integration tests that
 * need to look at schemas PostgREST never exposes (`vault`, `cron`, `net`).
 *
 * The Supabase CLI names the Postgres container after `project_id` in
 * `supabase/config.toml`, so the name is stable across machines and CI.
 * Everything else in the integration suite should keep using the
 * PostgREST clients in `./supabase`; this is for inspection and cleanup
 * of scheduler state only.
 *
 * @module tests/integration/helpers/sql
 */
import { execSync } from 'node:child_process'

/** `supabase_db_<project_id>` from `supabase/config.toml`. */
const CONTAINER = 'supabase_db_zebri-crm'

/**
 * Run one or more statements as `postgres` and return psql's unaligned,
 * tuples-only output, trimmed. Throws (with psql's stderr in the message)
 * when a statement fails, so a typo cannot pass as "no rows".
 */
export function runSql(sql: string): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER} psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`,
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()
  } catch (err) {
    const e = err as { stderr?: string; message: string }
    throw new Error(`runSql failed: ${e.stderr?.trim() || e.message}`)
  }
}
