#!/bin/sh
# Align the Supabase migration history with this repo's migrations and apply
# pending ones (0003_stripe_orders, 0004_admin_rls). This is the "proper fix"
# for the failing "Supabase Preview" check that gates Vercel production deploys.
#
# Why this works:
#   - The remote history contains migration versions that don't exist in
#     supabase/migrations/ (applied by another tool). `migration repair
#     --status reverted` removes ONLY the history entries — the database
#     objects stay. Our local files are fully idempotent
#     (create table if not exists / drop policy if exists / unique index
#     if not exists), so re-running them is a safe no-op for existing objects.
#   - `db push --include-all` then records the local files as the source of
#     truth and applies what's missing (0003, 0004).
#
# Requirements (secrets — never commit these):
#   SUPABASE_ACCESS_TOKEN  generate at supabase.com/dashboard/account/tokens
#   Supabase CLI binary    already vendored at .tools/supabase (Linux amd64)
#
# Usage:
#   sh scripts/fix-supabase-migrations.sh inspect
#       -> links the project, writes migration state to
#          supabase-migration-state.txt (gitignored) for review
#   sh scripts/fix-supabase-migrations.sh fix <remote-version> [more versions...]
#       -> marks those remote-only versions as reverted, pushes all local
#          migrations, then verifies. NEVER pass local versions (0001..0004).

set -e

PROJECT_REF="aebdqztoolszdzfbdlbp"
CLI=".tools/supabase"
STATE_FILE="supabase-migration-state.txt"

[ -x "$CLI" ] || { echo "Supabase CLI not found at $CLI"; exit 1; }
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens)}"
export SUPABASE_ACCESS_TOKEN

cmd="$1"; shift || true

case "$cmd" in
  inspect)
    "$CLI" link --project-ref "$PROJECT_REF" --yes
    {
      echo "=== migration list (local vs remote) ==="
      "$CLI" migration list || true
    } > "$STATE_FILE" 2>&1
    echo "Wrote $STATE_FILE — review it, then run:"
    echo "  sh scripts/fix-supabase-migrations.sh fix <remote-only-version> ..."
    ;;

  fix)
    [ "$#" -ge 1 ] || { echo "Usage: fix <remote-version> [more...]"; exit 1; }
    for v in "$@"; do
      case "$v" in
        0001|0002|0003|0004) echo "Refusing to repair local version $v"; exit 1 ;;
      esac
    done
    echo "--- Step 1: mark remote-only history entries as reverted (objects untouched) ---"
    "$CLI" migration repair --project-ref "$PROJECT_REF" --status reverted "$@"
    echo "--- Step 2: push all local migrations (idempotent; applies 0003 + 0004) ---"
    "$CLI" db push --project-ref "$PROJECT_REF" --include-all --yes
    echo "--- Step 3: verify ---"
    "$CLI" migration list
    echo "DONE. The 'Supabase Preview' check should pass on the next push to main."
    ;;

  *)
    echo "Usage: sh scripts/fix-supabase-migrations.sh inspect|fix"
    exit 1
    ;;
esac
