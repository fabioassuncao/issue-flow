# Ralph

Ralph is an autonomous AI agent loop that runs [Claude Code](https://docs.anthropic.com/en/docs/claude-code) repeatedly until all task plan items are complete. Each iteration is a fresh instance with clean context. Memory persists via git history, `progress.txt`, and the task plan JSON.

## System Requirements

### Supported Operating Systems

- **macOS** 12 (Monterey) or later
- **Ubuntu** 22.04 (Jammy) or later
- **Debian** 11 (Bullseye) or later

### Required Tools

| Tool | Minimum Version | Description |
|------|----------------|-------------|
| [Bash](https://www.gnu.org/software/bash/) | 3.2+ | Shell interpreter |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | latest | Anthropic's CLI for Claude |
| [jq](https://jqlang.github.io/jq/) | any | JSON processor for task plan management |
| [git](https://git-scm.com/) | any | Version control |

### Optional Tools (Remote Execution Only)

| Tool | Description |
|------|-------------|
| `curl` or `wget` | Required only when running Ralph remotely (to download `prompt.md`) |

### Installation

**macOS (Homebrew):**
```bash
brew install bash jq git
npm install -g @anthropic-ai/claude-code
```

> **Note:** Ralph works with the system Bash on supported macOS versions, including the default Bash 3.2 used by `curl ... | bash`. If you prefer to run a Homebrew-installed Bash explicitly, use `$(brew --prefix)/bin/bash scripts/ralph/ralph.sh`.

**Debian / Ubuntu (apt):**
```bash
sudo apt-get update && sudo apt-get install -y bash jq git curl
npm install -g @anthropic-ai/claude-code
```

## Usage

### Local execution

Run directly from a local clone of the repository:

```bash
# With the skills pipeline (recommended)
./scripts/ralph/ralph.sh --issue 42

# Standalone mode
./scripts/ralph/ralph.sh [max_iterations]
```

With `--issue`, Ralph reads from `issues/42/tasks.json` and writes progress to `issues/42/progress.txt`. In standalone mode, place a `prd.json` in `scripts/ralph/` and Ralph will use it directly.

### Remote execution

Run Ralph in any project without cloning this repository. The script automatically downloads `prompt.md` when it's not found locally:

```bash
# Show help
curl -sSL https://raw.githubusercontent.com/fabioassuncao/agent-skills/main/scripts/ralph/ralph.sh | bash -s -- --help

# Run issue #42
curl -sSL https://raw.githubusercontent.com/fabioassuncao/agent-skills/main/scripts/ralph/ralph.sh | bash -s -- --issue 42
```

In remote mode, standalone artifacts (`prd.json`, `progress.txt`) default to the git project root instead of `scripts/ralph/`.

### Setup for remote execution

First, generate the PRD and task plan using the `resolve-gh-issue` skill. Choose **option B** at the confirmation step to save artifacts without executing. Then run Ralph remotely (or locally) to execute the plan.

Without `--max-iterations` (or the positional numeric alias), Ralph runs until the issue is completed or it hits a fatal error.

### Options

| Flag | Description |
|------|-------------|
| `--issue N` | Issue number — reads artifacts from `issues/N/` instead of `scripts/ralph/` |
| `--max-iterations N` | Stop after `N` iterations (default: unlimited) |
| `--retry-limit N` | Retry transient Claude failures up to `N` consecutive times (default: `10`) |
| `--retry-forever` | Retry transient Claude failures indefinitely |
| `[number]` | Backward-compatible alias for `--max-iterations N` |

### Examples

```bash
# Run indefinitely for issue #42
./scripts/ralph/ralph.sh --issue 42

# Run at most 15 iterations for issue #42
./scripts/ralph/ralph.sh --issue 42 --max-iterations 15

# Retry transient Claude failures forever
./scripts/ralph/ralph.sh --issue 42 --retry-forever

# Run 5 iterations in standalone mode
./scripts/ralph/ralph.sh 5
```

## How It Works

1. Pick the highest priority story where `passes: false`
2. Implement that single story
3. Run quality checks (typecheck, tests)
4. Commit if checks pass
5. Update the task plan to mark story as `passes: true`
6. Append learnings to the progress log
7. Persist issue-level state in `tasks.json`
8. Repeat until all stories pass or an explicit limit/fatal error is reached

## Task Plan State

`issues/{N}/tasks.json` now tracks issue-level execution state:

```json
{
  "issueStatus": "pending",
  "completedAt": null,
  "lastAttemptAt": null,
  "lastError": null
}
```

- `issueStatus=completed` is the persistent marker that the issue is fully resolved
- Ralph only marks the issue completed after verifying every story has `passes=true`
- Transient Claude/API/network failures do not mark the issue complete and are retried automatically

When all stories are complete, Ralph exits with `<promise>COMPLETE</promise>` and persists `issueStatus=completed`.

## Local vs Remote Behavior

| Aspect | Local | Remote |
|--------|-------|--------|
| `prompt.md` | Read from `scripts/ralph/` | Downloaded to a temp dir (auto-cleaned on exit) |
| Standalone artifacts | Stored in `scripts/ralph/` | Stored in the git project root |
| `--issue` artifacts | `issues/N/` (same in both modes) | `issues/N/` (same in both modes) |
| Requirements | `jq`, Claude Code | `jq`, Claude Code, `curl` or `wget` |

## Credits

Based on [Geoffrey Huntley's Ralph pattern](https://ghuntley.com/ralph/) and the [snarktank/ralph](https://github.com/snarktank/ralph) repository.
