#!/usr/bin/env bash
#
# Migration safety check (Phase 0.7).
#
# Refuses to deploy migrations containing destructive SQL operations
# (DROP TABLE / DROP COLUMN / TRUNCATE / DROP SCHEMA / un-guarded DELETE FROM)
# unless the migration file explicitly opts in with a comment line:
#
#   -- @ALLOW_DESTRUCTIVE: <human reason, references prod plan, etc.>
#
# Scans only the migration files **added or modified in this push**
# (between $1 and $2). On a freshly-created branch where $1 is the zero
# SHA, the check is skipped (the safety net belongs to the eventual
# merge, not the branch creation).
#
# Usage:
#   scripts/check-migrations.sh <before-sha> <after-sha>

set -euo pipefail

BEFORE="${1:-}"
AFTER="${2:-HEAD}"

if [ -z "$BEFORE" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  echo "Migration safety: no prior commit (initial push) — skipping."
  exit 0
fi

# Added / Modified / Renamed *.sql files in supabase/migrations.
# Portable replacement for `mapfile` so the script works on macOS bash 3.
files=()
while IFS= read -r line; do
  [ -n "$line" ] && files+=("$line")
done < <(git diff --name-only --diff-filter=AMR "$BEFORE" "$AFTER" -- 'supabase/migrations/*.sql' || true)

if [ ${#files[@]} -eq 0 ]; then
  echo "Migration safety: no migration changes in this push."
  exit 0
fi

echo "Migration safety: checking ${#files[@]} file(s)..."

# Destructive SQL patterns (ERE, case-insensitive).
# DROP COLUMN / DROP TABLE / TRUNCATE / DROP SCHEMA cause data loss.
# Deliberately NOT flagged: DROP CONSTRAINT / DROP DEFAULT / DROP INDEX
# (structural-only — data preserved). DELETE FROM <table>; (no WHERE) is
# matched as a best-effort heuristic for an unguarded mass delete.
DESTRUCTIVE='(DROP[[:space:]]+TABLE|DROP[[:space:]]+COLUMN|TRUNCATE[[:space:]]+(TABLE[[:space:]]+)?[a-zA-Z_]+|DROP[[:space:]]+SCHEMA|DELETE[[:space:]]+FROM[[:space:]]+[a-zA-Z_]+[[:space:]]*;)'

failed=0
for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    # File deleted in this push — that's also a structural concern,
    # because deleting a migration the remote already recorded leaves a
    # ledger discrepancy. We don't fail on it (the seed-relocation work
    # in §7.8 needed exactly this), but we warn.
    echo "  ! $f  — deleted; expect a remote ledger discrepancy (use 'supabase migration repair' on the env)."
    continue
  fi
  if grep -qiE "$DESTRUCTIVE" "$f"; then
    if grep -qE '@ALLOW_DESTRUCTIVE' "$f"; then
      echo "  + $f  — destructive op allowed (marker present)"
    else
      echo "  - $f  — destructive op WITHOUT @ALLOW_DESTRUCTIVE marker"
      failed=1
    fi
  else
    echo "  · $f  — clean"
  fi
done

if [ $failed -ne 0 ]; then
  cat <<'MSG'

Migration safety FAILED.

Add a comment line like:
  -- @ALLOW_DESTRUCTIVE: <reason — what's dropped, why it's safe, who validated>
to each migration that intentionally drops/truncates data. See
.claude/docs/cicd.md for the destructive-migration runbook.
MSG
  exit 1
fi

echo "Migration safety: OK."
