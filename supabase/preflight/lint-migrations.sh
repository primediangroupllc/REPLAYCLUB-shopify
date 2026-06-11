#!/usr/bin/env bash
#
# Replay Club — migration pre-flight lint (v1, static, no DB required).
#
# Runs in CI BEFORE `supabase db push` (see .github/workflows/deploy-migrations.yml).
# A non-zero exit BLOCKS the deploy.
#
#   Check A (BLOCKING): every table CREATEd in a *changed* migration must have
#           `ENABLE ROW LEVEL SECURITY` somewhere in supabase/migrations/.
#           Catches the "new table shipped without RLS" class.
#           Deliberate exceptions: list bare table names (one per line) in
#           supabase/preflight/rls-exempt.txt.
#
#   Check B (ADVISORY): every table the frontend subscribes to via
#           `postgres_changes` should be added to the `supabase_realtime`
#           publication in a migration. Static analysis cannot see
#           dashboard-managed publication state, so this only WARNS in v1.
#           v2 (shadow-apply / live pg_publication_tables) upgrades it to blocking.
#
# Usage:
#   supabase/preflight/lint-migrations.sh [changed_migration.sql ...]
#     - args given             -> Check A runs on exactly those files
#     - CHANGED_MIGRATIONS env -> newline/space separated list (CI passes this)
#     - neither                -> derive from `git diff <BASE_SHA|HEAD~1> HEAD`
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 2

MIG_DIR="supabase/migrations"
SRC_DIR="src"
EXEMPT_FILE="supabase/preflight/rls-exempt.txt"

if [ -t 1 ]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; DIM=''; RST=''
fi

err=0

# ---- resolve changed migration files (Check A scope) -----------------------
raw=()
if [ "$#" -gt 0 ]; then
  raw=("$@")
elif [ -n "${CHANGED_MIGRATIONS:-}" ]; then
  # shellcheck disable=SC2206
  raw=( ${CHANGED_MIGRATIONS} )
else
  base="${BASE_SHA:-HEAD~1}"
  if git rev-parse --verify "$base" >/dev/null 2>&1; then
    while IFS= read -r line; do [ -n "$line" ] && raw+=("$line"); done \
      < <(git diff --name-only --diff-filter=AMR "$base" HEAD -- "$MIG_DIR" 2>/dev/null)
  fi
fi

# keep only existing *.sql under the migrations dir
changed=()
if [ "${#raw[@]}" -gt 0 ]; then
  for f in "${raw[@]}"; do
    case "$f" in
      "$MIG_DIR"/*.sql) [ -f "$f" ] && changed+=("$f") ;;
    esac
  done
fi

echo "== Replay Club migration pre-flight =="
echo "${DIM}repo: $REPO_ROOT${RST}"
echo "Changed migrations in scope: ${#changed[@]}"
if [ "${#changed[@]}" -gt 0 ]; then
  for f in "${changed[@]}"; do echo "  - ${f#"$MIG_DIR"/}"; done
fi
echo

# ---- exemptions ------------------------------------------------------------
is_exempt() {
  [ -f "$EXEMPT_FILE" ] || return 1
  grep -qxiE "[[:space:]]*$1[[:space:]]*" "$EXEMPT_FILE"
}

# ---- Check A: RLS enabled on newly-created tables --------------------------
echo "${DIM}-- Check A: RLS on newly-created tables (BLOCKING) --${RST}"
a_viol=0
if [ "${#changed[@]}" -gt 0 ]; then
  for f in "${changed[@]}"; do
    while IFS= read -r tbl; do
      [ -n "$tbl" ] || continue
      if is_exempt "$tbl"; then
        echo "  ${DIM}exempt: $tbl${RST}"
        continue
      fi
      if grep -rIiqE "ALTER[[:space:]]+TABLE[[:space:]]+(ONLY[[:space:]]+)?(public\.)?\"?${tbl}\"?[[:space:]]+ENABLE[[:space:]]+ROW[[:space:]]+LEVEL[[:space:]]+SECURITY" "$MIG_DIR"; then
        echo "  ${GRN}ok${RST}    $tbl  ${DIM}(RLS enabled)${RST}"
      else
        echo "  ${RED}FAIL${RST}  $tbl  ${DIM}created in ${f#"$MIG_DIR"/} — no ENABLE ROW LEVEL SECURITY found${RST}"
        a_viol=$((a_viol + 1)); err=1
      fi
    done < <(
      grep -hioE "CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(public\.)?\"?[a-z0-9_]+\"?" "$f" \
        | sed -E 's/.*[[:space:]."]([a-z0-9_]+)"?[[:space:]]*$/\1/I' \
        | sort -u
    )
  done
fi
if [ "$a_viol" -eq 0 ]; then echo "  ${GRN}Check A passed${RST}"; fi
echo

# ---- Check B: realtime publication cross-ref (advisory) --------------------
echo "${DIM}-- Check B: realtime subscriptions vs publication (ADVISORY) --${RST}"
# tables the frontend subscribes to via postgres_changes ( table: "name" )
subscribed=()
while IFS= read -r t; do [ -n "$t" ] && subscribed+=("$t"); done < <(
  grep -rhoE "table:[[:space:]]*['\"][a-z0-9_]+['\"]" "$SRC_DIR" 2>/dev/null \
    | sed -E "s/.*['\"]([a-z0-9_]+)['\"].*/\1/" | sort -u
)
# tables actually added to the supabase_realtime publication in migrations:
#   (1) direct:  ALTER PUBLICATION supabase_realtime ADD TABLE [public.]<name>[, ...]
#   (2) dynamic: ARRAY[ '<name>', ... ] looped through  ADD TABLE public.%I
# (Matching a table name anywhere in a publication migration would false-OK any
#  table merely ALTERed in the same file — e.g. bookings — so parse precisely.)
published="$(
  {
    grep -rhioE "ALTER[[:space:]]+PUBLICATION[[:space:]]+supabase_realtime[[:space:]]+ADD[[:space:]]+TABLE[[:space:]]+[^;]+" "$MIG_DIR" 2>/dev/null \
      | grep -v '%' \
      | sed -E 's/.*ADD[[:space:]]+TABLE[[:space:]]+//I' \
      | grep -oE "(public\.)?\"?[a-z0-9_]+\"?" \
      | sed -E 's/^public\.//; s/"//g'
    while IFS= read -r pf; do
      [ -n "$pf" ] || continue
      if grep -qiE "ADD[[:space:]]+TABLE[[:space:]]+public\.%I" "$pf"; then
        sed -nE "/ARRAY[[:space:]]*\[/,/\]/p" "$pf" | grep -oE "'[a-z0-9_]+'" | tr -d "'"
      fi
    done < <(grep -rilE "supabase_realtime" "$MIG_DIR" 2>/dev/null)
  } | grep -vxE "public|" | sort -u
)"
b_warn=0
if [ "${#subscribed[@]}" -gt 0 ]; then
  for t in "${subscribed[@]}"; do
    if printf '%s\n' "$published" | grep -qxF "$t"; then
      echo "  ${GRN}ok${RST}    $t  ${DIM}(added to supabase_realtime in a migration)${RST}"
    else
      echo "  ${YEL}WARN${RST}  $t  ${DIM}subscribed via postgres_changes, no publication ADD found in migrations${RST}"
      b_warn=$((b_warn + 1))
    fi
  done
fi
if [ "$b_warn" -gt 0 ]; then
  echo "  ${YEL}${b_warn} advisory warning(s).${RST} If realtime for these is dashboard-managed, confirm on prod (v2 checks live pg_publication_tables)."
else
  echo "  ${GRN}Check B clean${RST}"
fi
echo

# ---- verdict ---------------------------------------------------------------
if [ "$err" -ne 0 ]; then
  echo "${RED}x pre-flight FAILED — ${a_viol} RLS violation(s). Deploy blocked.${RST}"
  exit 1
fi
echo "${GRN}+ pre-flight passed${RST}"
exit 0
