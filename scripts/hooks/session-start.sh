#!/usr/bin/env bash
# EJS Hook: sessionStart
# Guarantees DB sync and journey file scaffold on every session start.
# Input (stdin): JSON with timestamp, cwd, source, initialPrompt
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat)"

# --- 1. Parse input (defensive — fields may be absent) ---
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
SOURCE="$(echo "$INPUT" | jq -r '.source // "unknown"' 2>/dev/null || true)"

# --- 2. DB sync ---
if [ -f "$REPO_ROOT/scripts/adr-db.py" ]; then
  python3 "$REPO_ROOT/scripts/adr-db.py" sync 2>/dev/null || true
fi

# --- 3. Determine today's date and next sequence number ---
TODAY="$(date -u +%Y-%m-%d)"
YEAR="$(date -u +%Y)"

JOURNEY_DIR="$REPO_ROOT/ejs-docs/journey/$YEAR"
mkdir -p "$JOURNEY_DIR"

# Find the next sequence number for today
SEQ=1
while [ -f "$JOURNEY_DIR/ejs-session-${TODAY}-$(printf '%02d' $SEQ).md" ]; do
  SEQ=$((SEQ + 1))
done
SEQ_FMT="$(printf '%02d' "$SEQ")"

SESSION_ID="ejs-session-${TODAY}-${SEQ_FMT}"
JOURNEY_FILE="$JOURNEY_DIR/${SESSION_ID}.md"

# --- 4. Scaffold journey file from template ---
TEMPLATE="$REPO_ROOT/ejs-docs/journey/_templates/journey-template.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "EJS Hook [session-start]: template not found at $TEMPLATE" >&2
  exit 0
fi

cp "$TEMPLATE" "$JOURNEY_FILE"

# --- 5. Populate frontmatter fields from environment ---
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
REPO_NAME="$(basename "$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo 'unknown')"

# Portable in-place sed (GNU sed -i vs BSD sed -i '' differ)
_sed_i() {
  local expr="$1" file="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i "$expr" "$file"            # GNU
  else
    sed -i '' "$expr" "$file"         # BSD / macOS
  fi
}
_sed_i "s/^session_id:.*/session_id: ${SESSION_ID}/" "$JOURNEY_FILE"
_sed_i "s/^date:.*/date: ${TODAY}/" "$JOURNEY_FILE"
_sed_i "s|^repo:.*|repo: ${REPO_NAME}|" "$JOURNEY_FILE"
_sed_i "s|^branch:.*|branch: ${BRANCH}|" "$JOURNEY_FILE"

# --- 6. Write active session marker for downstream hooks ---
echo "$JOURNEY_FILE" > "$REPO_ROOT/.ejs-session-active"

echo "EJS Hook [session-start]: created $JOURNEY_FILE (source=$SOURCE)" >&2
exit 0
