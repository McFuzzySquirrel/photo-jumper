#!/usr/bin/env bash
# EJS Hook: subagentStop
# Logs sub-agent completion events to the journey file.
# Input (stdin): JSON with sub-agent event details
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat)"

# --- 1. Parse input (defensive — fields may be absent or schema may evolve) ---
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
AGENT_NAME="$(echo "$INPUT" | jq -r '.agentName // .agent_name // "unknown"' 2>/dev/null || true)"
TASK_DESC="$(echo "$INPUT" | jq -r '.taskDescription // .task // ""' 2>/dev/null || true)"

# Format timestamp for human readability (portable: GNU date -d vs BSD date -r)
_epoch_to_iso() {
  local epoch_secs="$1"
  if date --version >/dev/null 2>&1; then
    date -u -d "@${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  else
    date -u -r "${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  fi
}

if [ -n "$TIMESTAMP" ]; then
  # Timestamps may be epoch millis; convert to ISO if numeric
  if echo "$TIMESTAMP" | grep -qE '^[0-9]+$'; then
    TS_DISPLAY="$(_epoch_to_iso "$((TIMESTAMP / 1000))")"
  else
    TS_DISPLAY="$TIMESTAMP"
  fi
else
  TS_DISPLAY="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# --- 2. Locate the active journey file ---
MARKER="$REPO_ROOT/.ejs-session-active"
if [ ! -f "$MARKER" ]; then
  echo "EJS Hook [subagent-stop]: no active session marker — skipping" >&2
  exit 0
fi

JOURNEY_FILE="$(cat "$MARKER")"
if [ ! -f "$JOURNEY_FILE" ]; then
  echo "EJS Hook [subagent-stop]: journey file not found — skipping" >&2
  exit 0
fi

# --- 3. Append a placeholder entry to Sub-Agent Contributions ---
{
  echo ""
  echo "## Sub-Agent: ${AGENT_NAME}"
  echo "- **Timestamp:** ${TS_DISPLAY}"
  echo "- **Task delegated:** ${TASK_DESC:-_To be filled by parent agent_}"
  echo "- **Decisions made:** _To be filled by parent agent_"
  echo "- **Alternatives considered:** _To be filled by parent agent_"
  echo "- **Outcome:** _To be filled by parent agent_"
  echo "- **Handoff to other agents:** _To be filled by parent agent_"
  echo "<!-- Logged by EJS Hook [subagent-stop] -->"
} >> "$JOURNEY_FILE"

# --- 4. Log to JSONL audit file ---
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

jq -n \
  --arg ts "$TS_DISPLAY" \
  --arg agent "$AGENT_NAME" \
  --arg task "$TASK_DESC" \
  --arg journey "$(basename "$JOURNEY_FILE")" \
  '{event:"subagent_stop",timestamp:$ts,agent:$agent,task:$task,journey:$journey}' \
  >> "$LOG_DIR/ejs-subagent-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [subagent-stop]: logged ${AGENT_NAME} event to $JOURNEY_FILE" >&2
exit 0
