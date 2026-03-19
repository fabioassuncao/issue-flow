#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--issue N] [max_iterations]

set -e

# Parse arguments
MAX_ITERATIONS=10
ISSUE_NUMBER=""

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
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
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

echo "Starting Ralph - Max iterations: $MAX_ITERATIONS"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS"
  echo "==============================================================="

  # Run Claude Code with the ralph prompt (with placeholders replaced)
  PROMPT=$(sed \
    -e "s|__PRD_FILE__|$PRD_FILE|g" \
    -e "s|__PROGRESS_FILE__|$PROGRESS_FILE|g" \
    "$SCRIPT_DIR/prompt.md")

  OUTPUT=$(echo "$PROMPT" | claude --dangerously-skip-permissions --print 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
