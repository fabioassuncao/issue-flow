#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--issue N] [--max-iterations N] [--retry-limit N] [--retry-forever]

set -eo pipefail

MAX_ITERATIONS=""
RETRY_LIMIT=10
RETRY_FOREVER=0
ISSUE_NUMBER=""
BACKOFF_BASE_SECONDS=30
BACKOFF_MAX_SECONDS=900

usage() {
  cat <<EOF
Usage: ./ralph.sh [--issue N] [--max-iterations N] [--retry-limit N] [--retry-forever]

Options:
  --issue N             Read/write artifacts from issues/N/
  --max-iterations N    Stop after N iterations (default: unlimited)
  --retry-limit N       Retry transient Claude failures up to N consecutive times (default: 10)
  --retry-forever       Retry transient Claude failures indefinitely
  -h, --help            Show this help text

Compatibility:
  A trailing numeric argument is still accepted as an alias for --max-iterations.
EOF
}

require_numeric_arg() {
  local flag="$1"
  local value="$2"

  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    echo "Error: $flag requires a non-negative integer, got '$value'."
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --issue)
      ISSUE_NUMBER="$2"
      shift 2
      ;;
    --issue=*)
      ISSUE_NUMBER="${1#*=}"
      shift
      ;;
    --max-iterations)
      require_numeric_arg "$1" "$2"
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --max-iterations=*)
      MAX_ITERATIONS="${1#*=}"
      require_numeric_arg "--max-iterations" "$MAX_ITERATIONS"
      shift
      ;;
    --retry-limit)
      require_numeric_arg "$1" "$2"
      RETRY_LIMIT="$2"
      shift 2
      ;;
    --retry-limit=*)
      RETRY_LIMIT="${1#*=}"
      require_numeric_arg "--retry-limit" "$RETRY_LIMIT"
      shift
      ;;
    --retry-forever)
      RETRY_FOREVER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
        shift
      else
        echo "Error: unknown argument '$1'."
        usage
        exit 1
      fi
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ -n "$ISSUE_NUMBER" ]; then
  # Skills pipeline mode
  PRD_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/tasks.json"
  PROGRESS_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/progress.txt"
  ARCHIVE_DIR="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/archive"
  LAST_BRANCH_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/.last-branch"
else
  # Standalone mode (original)
  PRD_FILE="$SCRIPT_DIR/prd.json"
  PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
  ARCHIVE_DIR="$SCRIPT_DIR/archive"
  LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
fi

if [ ! -f "$PRD_FILE" ]; then
  echo "Error: PRD file not found at $PRD_FILE"
  if [ -n "$ISSUE_NUMBER" ]; then
    echo "Have you run the resolve-gh-issue skill for issue #${ISSUE_NUMBER} first?"
  fi
  exit 1
fi

iso_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

update_task_plan() {
  local jq_filter="$1"
  local tmp_file

  tmp_file=$(mktemp "${TMPDIR:-/tmp}/ralph-task-plan.XXXXXX")
  jq "$jq_filter" "$PRD_FILE" > "$tmp_file"
  mv "$tmp_file" "$PRD_FILE"
}

all_stories_pass() {
  jq -e '
    (.userStories // []) as $stories
    | ($stories | length) > 0
    and all($stories[]; .passes == true)
  ' "$PRD_FILE" >/dev/null
}

escape_json_string() {
  printf '%s' "$1" | jq -Rs .
}

trim_error_message() {
  printf '%s' "$1" | awk 'NF { print; count++; if (count == 8) exit }'
}

set_last_error() {
  local category="$1"
  local message="$2"
  local timestamp
  local message_json

  timestamp=$(iso_now)
  message_json=$(escape_json_string "$message")
  update_task_plan "
    .lastAttemptAt = \"$timestamp\"
    | .lastError = {
        category: \"$category\",
        message: $message_json,
        at: \"$timestamp\"
      }
  "
}

clear_last_error() {
  local attempt_started_at="$1"
  local timestamp

  timestamp=$(iso_now)
  update_task_plan "
    .lastAttemptAt = \"$timestamp\"
    | if ((.lastError.at? // \"\") > \"$attempt_started_at\") then
        .
      else
        .lastError = null
      end
  "
}

mark_issue_in_progress() {
  local timestamp="${1:-$(iso_now)}"
  update_task_plan "
    .issueStatus = \"in_progress\"
    | .completedAt = null
    | .lastAttemptAt = \"$timestamp\"
  "
}

mark_issue_completed() {
  local timestamp
  timestamp=$(iso_now)
  update_task_plan "
    .issueStatus = \"completed\"
    | .completedAt = \"$timestamp\"
    | .lastAttemptAt = \"$timestamp\"
    | .lastError = null
  "
}

initialize_task_plan_state() {
  update_task_plan '
    .issueStatus = (.issueStatus // "pending")
    | .completedAt = (.completedAt // null)
    | .lastAttemptAt = (.lastAttemptAt // null)
    | .lastError = (.lastError // null)
  '
}

is_transient_claude_failure() {
  local exit_code="$1"
  local output="$2"
  local lowered_output

  lowered_output=$(printf '%s' "$output" | tr '[:upper:]' '[:lower:]')

  if [ "$exit_code" -eq 75 ]; then
    return 0
  fi

  if printf '%s' "$lowered_output" | grep -Eq \
    'timed out|timeout|connection reset|connection refused|connection aborted|network error|network unavailable|temporary failure|temporarily unavailable|service unavailable|overloaded|rate limit|too many requests|bad gateway|gateway timeout|internal server error|http 429|http 500|http 502|http 503|http 504|econnreset|econnrefused|enotfound|etimedout|socket hang up'; then
    return 0
  fi

  return 1
}

retry_delay_seconds() {
  local attempt="$1"
  local delay=$((BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))))

  if [ "$delay" -gt "$BACKOFF_MAX_SECONDS" ]; then
    delay="$BACKOFF_MAX_SECONDS"
  fi

  echo "$delay"
}

initialize_task_plan_state

if jq -e '.issueStatus == "completed"' "$PRD_FILE" >/dev/null; then
  if all_stories_pass; then
    echo "Issue already marked complete in $PRD_FILE"
    exit 0
  fi

  echo "Warning: issue marked completed but some stories are still pending. Resetting to in_progress."
  mark_issue_in_progress
  set_last_error "invalid_completion_state" "tasks.json claimed the issue was completed before every story had passes=true."
fi

if all_stories_pass; then
  echo "All user stories already pass. Marking issue as completed."
  mark_issue_completed
  exit 0
fi

# Archive previous run if branch changed
if [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ]; then
  echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

if [ -n "$MAX_ITERATIONS" ]; then
  echo "Starting Ralph - Max iterations: $MAX_ITERATIONS"
else
  echo "Starting Ralph - Max iterations: unlimited"
fi

if [ "$RETRY_FOREVER" -eq 1 ]; then
  echo "Transient retry policy: unlimited retries"
else
  echo "Transient retry policy: $RETRY_LIMIT consecutive retries"
fi

i=0
retry_count=0
while true; do
  iteration_started_at=""

  if [ -n "$MAX_ITERATIONS" ] && [ "$i" -ge "$MAX_ITERATIONS" ]; then
    break
  fi

  i=$((i + 1))
  echo ""
  echo "==============================================================="
  if [ -n "$MAX_ITERATIONS" ]; then
    echo "  Ralph Iteration $i of $MAX_ITERATIONS"
  else
    echo "  Ralph Iteration $i"
  fi
  echo "==============================================================="

  # Run Claude Code with the ralph prompt (with placeholders replaced)
  PROMPT=$(sed \
    -e "s|__PRD_FILE__|$PRD_FILE|g" \
    -e "s|__PROGRESS_FILE__|$PROGRESS_FILE|g" \
    "$SCRIPT_DIR/prompt.md")

  iteration_started_at=$(iso_now)
  mark_issue_in_progress "$iteration_started_at"

  set +e
  OUTPUT=$(printf '%s\n' "$PROMPT" | claude --dangerously-skip-permissions --print 2>&1)
  CLAUDE_EXIT=$?
  set -e

  if [ -n "$OUTPUT" ]; then
    printf '%s\n' "$OUTPUT" >&2
  fi

  if [ "$CLAUDE_EXIT" -ne 0 ]; then
    ERROR_MESSAGE=$(trim_error_message "$OUTPUT")

    if is_transient_claude_failure "$CLAUDE_EXIT" "$OUTPUT"; then
      retry_count=$((retry_count + 1))
      set_last_error "transient_claude_failure" "$ERROR_MESSAGE"

      if [ "$RETRY_FOREVER" -ne 1 ] && [ "$retry_count" -gt "$RETRY_LIMIT" ]; then
        echo ""
        echo "Claude CLI failed with a transient error on iteration $i and exceeded the retry limit ($RETRY_LIMIT)."
        exit "$CLAUDE_EXIT"
      fi

      DELAY_SECONDS=$(retry_delay_seconds "$retry_count")
      echo ""
      echo "Transient Claude failure on iteration $i (attempt $retry_count). Retrying in ${DELAY_SECONDS}s."
      # Retries should stay within the current iteration budget.
      i=$((i - 1))
      sleep "$DELAY_SECONDS"
      continue
    fi

    set_last_error "fatal_claude_failure" "$ERROR_MESSAGE"
    echo ""
    echo "Claude CLI failed on iteration $i with exit code $CLAUDE_EXIT."
    exit "$CLAUDE_EXIT"
  fi

  retry_count=0
  clear_last_error "$iteration_started_at"

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    if all_stories_pass; then
      mark_issue_completed
      echo ""
      echo "Ralph completed all tasks!"
      if [ -n "$MAX_ITERATIONS" ]; then
        echo "Completed at iteration $i of $MAX_ITERATIONS"
      else
        echo "Completed at iteration $i"
      fi
      exit 0
    fi

    set_last_error "invalid_completion_signal" "Claude returned <promise>COMPLETE</promise> before every story had passes=true."
    echo ""
    echo "Claude returned a completion signal, but tasks.json still has pending stories. Ignoring completion and continuing."
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations (${MAX_ITERATIONS}) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
