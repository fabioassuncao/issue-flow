# Ralph

Ralph is an autonomous AI agent loop that runs [Claude Code](https://docs.anthropic.com/en/docs/claude-code) repeatedly until all task plan items are complete. Each iteration is a fresh instance with clean context. Memory persists via git history, `progress.txt`, and the task plan JSON.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- `jq` installed (`brew install jq` on macOS)
- A git repository for your project

## Usage

### With the skills pipeline (recommended)

First, generate the PRD and task plan using the `resolve-gh-issue` skill. Choose **option B** at the confirmation step to save artifacts without executing. Then run Ralph:

```bash
./scripts/ralph/ralph.sh --issue 42
```

This reads from `issues/42/tasks.json` and writes progress to `issues/42/progress.txt`.

### Standalone mode

Place a `prd.json` and optionally a `progress.txt` in the `scripts/ralph/` directory, then run:

```bash
./scripts/ralph/ralph.sh [max_iterations]
```

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

## Credits

Based on [Geoffrey Huntley's Ralph pattern](https://ghuntley.com/ralph/) and the [snarktank/ralph](https://github.com/snarktank/ralph) repository.
