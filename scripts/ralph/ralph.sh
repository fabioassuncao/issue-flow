#!/usr/bin/env bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--issue N] [--max-iterations N] [--retry-limit N] [--retry-forever]

set -euo pipefail

# Cache OS detection (used for platform-specific install hints)
_RALPH_OS="$(uname -s)"

MAX_ITERATIONS=""
RETRY_LIMIT=10
RETRY_FOREVER=0
ISSUE_NUMBER=""
BACKOFF_BASE_SECONDS=30
BACKOFF_MAX_SECONDS=900
RALPH_TMP_DIR=""
PROMPT_FILE=""

cleanup() {
  if [ -n "${RALPH_TMP_DIR:-}" ] && [ -d "$RALPH_TMP_DIR" ]; then
    rm -rf "$RALPH_TMP_DIR"
  fi
}
trap cleanup EXIT

# --- Color and Icon Utility System ---

setup_colors() {
  USE_COLOR=1
  USE_UNICODE=1
  TERM_WIDTH=80

  # Disable color/unicode if NO_COLOR is set
  if [ "${NO_COLOR:-}" = "1" ]; then
    USE_COLOR=0
    USE_UNICODE=0
  fi

  # Disable color/unicode if stdout is not a TTY
  if [ ! -t 1 ]; then
    USE_COLOR=0
    USE_UNICODE=0
  fi

  # Detect terminal width
  if command -v tput >/dev/null 2>&1 && tput cols >/dev/null 2>&1; then
    TERM_WIDTH=$(tput cols)
  fi

  if [ "$USE_COLOR" -eq 1 ]; then
    CLR_GREEN='\033[0;32m'
    CLR_RED='\033[0;31m'
    CLR_YELLOW='\033[0;33m'
    CLR_BLUE='\033[0;34m'
    CLR_GRAY='\033[0;90m'
    CLR_RESET='\033[0m'
  else
    CLR_GREEN=''
    CLR_RED=''
    CLR_YELLOW=''
    CLR_BLUE=''
    CLR_GRAY=''
    CLR_RESET=''
  fi

  if [ "$USE_UNICODE" -eq 1 ]; then
    ICON_SUCCESS='✓'
    ICON_FAIL='✗'
    ICON_PENDING='⏳'
    ICON_RETRY='↻'
    ICON_WARN='⚠'
    ICON_START='▶'
    ICON_END='■'
  else
    ICON_SUCCESS='[OK]'
    ICON_FAIL='[FAIL]'
    ICON_PENDING='[...]'
    ICON_RETRY='[RETRY]'
    ICON_WARN='[WARN]'
    ICON_START='[START]'
    ICON_END='[END]'
  fi
}

print_success() {
  printf '%b%s%b\n' "${CLR_GREEN}${ICON_SUCCESS} " "$*" "${CLR_RESET}"
}

print_error() {
  printf '%b%s%b\n' "${CLR_RED}${ICON_FAIL} " "$*" "${CLR_RESET}"
}

print_warning() {
  printf '%b%s%b\n' "${CLR_YELLOW}${ICON_WARN} " "$*" "${CLR_RESET}"
}

print_retry() {
  printf '%b%s%b\n' "${CLR_YELLOW}${ICON_RETRY} " "$*" "${CLR_RESET}"
}

print_info() {
  printf '%b%s%b\n' "${CLR_BLUE}${ICON_START} " "$*" "${CLR_RESET}"
}

# --- Box Drawing Utilities ---

# Truncate or pad a string to fit within a given width
_fit_line() {
  local text="$1"
  local width="$2"
  local len=${#text}

  if [ "$len" -gt "$width" ]; then
    printf '%s' "${text:0:$width}"
  else
    printf '%-*s' "$width" "$text"
  fi
}

print_box() {
  local -a lines=()
  local line=""
  local max_content_width=0

  # Collect lines from arguments
  while [ $# -gt 0 ]; do
    lines+=("$1")
    local len=${#1}
    if [ "$len" -gt "$max_content_width" ]; then
      max_content_width=$len
    fi
    shift
  done

  # Cap box width to terminal width (border chars + 2 padding spaces = 4 chars)
  local available=$((TERM_WIDTH - 4))
  if [ "$max_content_width" -gt "$available" ]; then
    max_content_width=$available
  fi
  if [ "$max_content_width" -lt 20 ]; then
    max_content_width=20
  fi

  local box_tl box_tr box_bl box_br box_h box_v box_sep_l box_sep_r
  if [ "$USE_UNICODE" -eq 1 ]; then
    box_tl='╭' box_tr='╮' box_bl='╰' box_br='╯'
    box_h='─' box_v='│' box_sep_l='├' box_sep_r='┤'
  else
    box_tl='+' box_tr='+' box_bl='+' box_br='+'
    box_h='-' box_v='|' box_sep_l='+' box_sep_r='+'
  fi

  # Build horizontal rule
  local hrule=""
  local j=0
  while [ "$j" -lt "$((max_content_width + 2))" ]; do
    hrule="${hrule}${box_h}"
    j=$((j + 1))
  done

  # Print top border
  printf '%b%s%s%s%b\n' "$CLR_BLUE" "$box_tl" "$hrule" "$box_tr" "$CLR_RESET"

  # Print content lines
  for line in "${lines[@]}"; do
    if [ "$line" = "---" ]; then
      printf '%b%s%s%s%b\n' "$CLR_BLUE" "$box_sep_l" "$hrule" "$box_sep_r" "$CLR_RESET"
    else
      local fitted
      fitted=$(_fit_line "$line" "$max_content_width")
      printf '%b%s%b %s %b%s%b\n' "$CLR_BLUE" "$box_v" "$CLR_RESET" "$fitted" "$CLR_BLUE" "$box_v" "$CLR_RESET"
    fi
  done

  # Print bottom border
  printf '%b%s%s%s%b\n' "$CLR_BLUE" "$box_bl" "$hrule" "$box_br" "$CLR_RESET"
}

print_startup_header() {
  local stories_total stories_passing branch_name issue_label
  local max_iter_label retry_label

  stories_total=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo "0")
  stories_passing=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
  branch_name=$(jq -r '.branchName // "N/A"' "$PRD_FILE" 2>/dev/null || echo "N/A")

  if [ -n "$ISSUE_NUMBER" ]; then
    issue_label="Issue #${ISSUE_NUMBER}"
  else
    issue_label="Standalone mode"
  fi

  if [ -n "$MAX_ITERATIONS" ]; then
    max_iter_label="$MAX_ITERATIONS"
  else
    max_iter_label="unlimited"
  fi

  if [ "$RETRY_FOREVER" -eq 1 ]; then
    retry_label="unlimited retries"
  else
    retry_label="$RETRY_LIMIT consecutive retries"
  fi

  local title_icon="$ICON_START"
  print_box \
    "${title_icon} Ralph Wiggum" \
    "---" \
    "Issue:       ${issue_label}" \
    "Branch:      ${branch_name}" \
    "Stories:     ${stories_passing}/${stories_total} passing" \
    "Iterations:  ${max_iter_label}" \
    "Retries:     ${retry_label}"
}

# --- Progress Display Utilities ---

print_progress_bar() {
  local passed="$1"
  local total="$2"
  local bar_width=20
  local filled=0
  local pct=0

  if [ "$total" -gt 0 ]; then
    pct=$((passed * 100 / total))
    filled=$((passed * bar_width / total))
  fi

  local empty=$((bar_width - filled))

  local fill_char empty_char
  if [ "$USE_UNICODE" -eq 1 ]; then
    fill_char='█'
    empty_char='░'
  else
    fill_char='#'
    empty_char='-'
  fi

  local bar=""
  local j=0
  while [ "$j" -lt "$filled" ]; do
    bar="${bar}${fill_char}"
    j=$((j + 1))
  done
  j=0
  while [ "$j" -lt "$empty" ]; do
    bar="${bar}${empty_char}"
    j=$((j + 1))
  done

  printf '%b%s%b %s/%s (%s%%)' "$CLR_GREEN" "$bar" "$CLR_RESET" "$passed" "$total" "$pct"
}

print_iteration_header() {
  local iteration="$1"
  local max_iter="${2:-}"

  local iter_label
  if [ -n "$max_iter" ]; then
    iter_label="Iteration ${iteration} of ${max_iter}"
  else
    iter_label="Iteration ${iteration}"
  fi

  # Read story data
  local stories_json
  stories_json=$(jq -c '.userStories // []' "$PRD_FILE" 2>/dev/null || echo '[]')
  local total
  total=$(printf '%s' "$stories_json" | jq 'length')
  local passed
  passed=$(printf '%s' "$stories_json" | jq '[.[] | select(.passes == true)] | length')

  echo ""
  printf '%b━━━ %s %s ━━━%b\n' "$CLR_BLUE" "$ICON_START" "$iter_label" "$CLR_RESET"
  echo ""

  # Display each story status
  local idx=0
  while [ "$idx" -lt "$total" ]; do
    local sid stitle spasses
    sid=$(printf '%s' "$stories_json" | jq -r ".[$idx].id")
    stitle=$(printf '%s' "$stories_json" | jq -r ".[$idx].title")
    spasses=$(printf '%s' "$stories_json" | jq -r ".[$idx].passes")

    local icon color
    if [ "$spasses" = "true" ]; then
      icon="$ICON_SUCCESS"
      color="$CLR_GREEN"
    else
      # Check if this is the next story to work on (first non-passing)
      local prior_all_pass=true
      local k=0
      while [ "$k" -lt "$idx" ]; do
        local kpasses
        kpasses=$(printf '%s' "$stories_json" | jq -r ".[$k].passes")
        if [ "$kpasses" != "true" ]; then
          prior_all_pass=false
          break
        fi
        k=$((k + 1))
      done
      if [ "$prior_all_pass" = "true" ]; then
        # This is the current in-progress story
        icon="$ICON_PENDING"
        color="$CLR_YELLOW"
      else
        # Pending (not yet reached)
        if [ "$USE_UNICODE" -eq 1 ]; then
          icon="○"
        else
          icon="[ ]"
        fi
        color="$CLR_GRAY"
      fi
    fi

    printf '  %b%s %s: %s%b\n' "$color" "$icon" "$sid" "$stitle" "$CLR_RESET"
    idx=$((idx + 1))
  done

  echo ""
  printf '  '
  print_progress_bar "$passed" "$total"
  echo ""
}

# --- Summary Utilities ---

format_duration() {
  local total_seconds="$1"
  local mins=$((total_seconds / 60))
  local secs=$((total_seconds % 60))

  if [ "$mins" -gt 0 ]; then
    printf '%dm %ds' "$mins" "$secs"
  else
    printf '%ds' "$secs"
  fi
}

print_summary_box() {
  local status="$1"
  local iterations="$2"
  local retries="$3"
  local extra_info="${4:-}"

  local elapsed=$(( SECONDS - RALPH_START_SECONDS ))
  local duration
  duration=$(format_duration "$elapsed")

  local stories_total stories_passing
  stories_total=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo "0")
  stories_passing=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")

  local status_icon status_label
  case "$status" in
    success)
      status_icon="$ICON_SUCCESS"
      status_label="Completed"
      ;;
    incomplete)
      status_icon="$ICON_WARN"
      status_label="Incomplete"
      ;;
    failed)
      status_icon="$ICON_FAIL"
      status_label="Failed"
      ;;
  esac

  local end_icon="$ICON_END"
  local box_lines=()
  box_lines+=("${end_icon} Ralph Summary")
  box_lines+=("---")
  box_lines+=("Status:      ${status_icon} ${status_label}")
  box_lines+=("Stories:     ${stories_passing}/${stories_total} passing")
  box_lines+=("Iterations:  ${iterations}")
  box_lines+=("Duration:    ${duration}")
  box_lines+=("Retries:     ${retries}")

  if [ -n "$extra_info" ]; then
    box_lines+=("---")
    box_lines+=("$extra_info")
  fi

  echo ""
  print_box "${box_lines[@]}"
}

# --- End Summary Utilities ---

# --- End Progress Display Utilities ---

# --- End Box Drawing Utilities ---

setup_colors

# --- End Color and Icon Utility System ---

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

require_arg_value() {
  local flag="$1"
  local value="${2-}"

  if [ -z "$value" ]; then
    echo "Error: $flag requires a value."
    usage
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --issue)
      require_arg_value "$1" "${2-}"
      ISSUE_NUMBER="$2"
      shift 2
      ;;
    --issue=*)
      ISSUE_NUMBER="${1#*=}"
      shift
      ;;
    --max-iterations)
      require_arg_value "$1" "${2-}"
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
      require_arg_value "$1" "${2-}"
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

# Return a platform-appropriate install command for a given package
_install_hint() {
  local pkg="$1"
  if [ "$_RALPH_OS" = "Darwin" ]; then
    echo "brew install $pkg"
  elif command -v apt-get >/dev/null 2>&1; then
    echo "sudo apt-get install $pkg"
  elif command -v dnf >/dev/null 2>&1; then
    echo "sudo dnf install $pkg"
  elif command -v pacman >/dev/null 2>&1; then
    echo "sudo pacman -S $pkg"
  elif command -v apk >/dev/null 2>&1; then
    echo "apk add $pkg"
  else
    echo "install $pkg using your system package manager"
  fi
}

# Validate required dependencies
_missing=()
for _dep in jq git claude; do
  if ! command -v "$_dep" >/dev/null 2>&1; then
    _missing+=("$_dep")
  fi
done

if [ "${#_missing[@]}" -gt 0 ]; then
  echo "Error: the following required tools are not installed:"
  for _dep in "${_missing[@]}"; do
    case "$_dep" in
      claude)
        echo "  - claude  (install with: npm install -g @anthropic-ai/claude-code)"
        ;;
      *)
        echo "  - $_dep  (install with: $(_install_hint "$_dep"))"
        ;;
    esac
  done
  exit 1
fi

# Try to resolve SCRIPT_DIR from BASH_SOURCE
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" != "bash" ]; then
  _candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  if [ -d "$_candidate" ] && [ -f "$_candidate/prompt.md" ]; then
    SCRIPT_DIR="$_candidate"
  fi
fi

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Resolve prompt.md location
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/prompt.md" ]; then
  PROMPT_FILE="$SCRIPT_DIR/prompt.md"
else
  # Validate curl/wget early — the download block below assumes one is available
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    echo "Error: curl or wget is required to download prompt.md in remote mode."
    echo "  Install with: $(_install_hint curl)"
    exit 1
  fi

  echo "prompt.md not found locally, downloading remote version..."
  RALPH_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/ralph.XXXXXX")
  REMOTE_URL="https://raw.githubusercontent.com/fabioassuncao/issue-flow/main/scripts/ralph/prompt.md"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$REMOTE_URL" -o "$RALPH_TMP_DIR/prompt.md"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$RALPH_TMP_DIR/prompt.md" "$REMOTE_URL"
  fi

  if [ ! -s "$RALPH_TMP_DIR/prompt.md" ]; then
    echo "Error: failed to download prompt.md from remote"
    exit 1
  fi

  PROMPT_FILE="$RALPH_TMP_DIR/prompt.md"
fi

if [ -n "$ISSUE_NUMBER" ]; then
  # Skills pipeline mode
  PRD_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/tasks.json"
  PROGRESS_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/progress.txt"
  ARCHIVE_DIR="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/archive"
  LAST_BRANCH_FILE="$PROJECT_ROOT/issues/${ISSUE_NUMBER}/.last-branch"
else
  # Standalone mode — use SCRIPT_DIR if available, otherwise PROJECT_ROOT
  _base="${SCRIPT_DIR:-$PROJECT_ROOT}"
  PRD_FILE="$_base/prd.json"
  PROGRESS_FILE="$_base/progress.txt"
  ARCHIVE_DIR="$_base/archive"
  LAST_BRANCH_FILE="$_base/.last-branch"
fi

if [ ! -f "$PRD_FILE" ]; then
  echo "Error: PRD file not found at $PRD_FILE"
  if [ -n "$ISSUE_NUMBER" ]; then
    echo "Have you run the resolve-issue skill for issue #${ISSUE_NUMBER} first?"
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
    | if .pipeline then .pipeline.executionCompleted = true else . end
  "
}

initialize_task_plan_state() {
  update_task_plan '
    .issueStatus = (.issueStatus // "pending")
    | .completedAt = (.completedAt // null)
    | .lastAttemptAt = (.lastAttemptAt // null)
    | .lastError = (.lastError // null)
    | .correctionCycle = (.correctionCycle // 0)
    | .maxCorrectionCycles = (.maxCorrectionCycles // 3)
    | .pipeline = (.pipeline // {
        "analyzeCompleted": false,
        "prdCompleted": false,
        "jsonCompleted": false,
        "executionCompleted": false,
        "reviewCompleted": false,
        "prCreated": false
      })
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

  print_warning "Issue marked completed but some stories are still pending. Resetting to in_progress."
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

print_startup_header

# Record execution start time for duration tracking
RALPH_START_SECONDS=$SECONDS

i=0
retry_count=0
total_retry_count=0
while true; do
  iteration_started_at=""

  if [ -n "$MAX_ITERATIONS" ] && [ "$i" -ge "$MAX_ITERATIONS" ]; then
    break
  fi

  i=$((i + 1))
  print_iteration_header "$i" "$MAX_ITERATIONS"

  # Run Claude Code with the ralph prompt (with placeholders replaced)
  PROMPT=$(sed \
    -e "s|__PRD_FILE__|$PRD_FILE|g" \
    -e "s|__PROGRESS_FILE__|$PROGRESS_FILE|g" \
    "$PROMPT_FILE")

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
      total_retry_count=$((total_retry_count + 1))
      set_last_error "transient_claude_failure" "$ERROR_MESSAGE"

      if [ "$RETRY_FOREVER" -ne 1 ] && [ "$retry_count" -gt "$RETRY_LIMIT" ]; then
        print_summary_box "failed" "$i" "$total_retry_count" "Exceeded retry limit ($RETRY_LIMIT) on transient errors"
        exit "$CLAUDE_EXIT"
      fi

      DELAY_SECONDS=$(retry_delay_seconds "$retry_count")
      echo ""
      print_retry "Transient Claude failure on iteration $i (attempt $retry_count). Retrying in ${DELAY_SECONDS}s."
      # Retries should stay within the current iteration budget.
      i=$((i - 1))
      sleep "$DELAY_SECONDS"
      continue
    fi

    set_last_error "fatal_claude_failure" "$ERROR_MESSAGE"
    print_summary_box "failed" "$i" "$total_retry_count" "Claude CLI failed with exit code $CLAUDE_EXIT"
    exit "$CLAUDE_EXIT"
  fi

  retry_count=0
  clear_last_error "$iteration_started_at"

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    if all_stories_pass; then
      mark_issue_completed
      print_summary_box "success" "$i" "$total_retry_count"
      exit 0
    fi

    set_last_error "invalid_completion_signal" "Claude returned <promise>COMPLETE</promise> before every story had passes=true."
    echo ""
    print_warning "Claude returned a completion signal, but tasks.json still has pending stories. Ignoring completion and continuing."
  fi

  print_success "Iteration $i complete. Continuing..."
  sleep 2
done

print_summary_box "incomplete" "$MAX_ITERATIONS" "$total_retry_count" "Reached max iterations without completing all tasks."
exit 1
