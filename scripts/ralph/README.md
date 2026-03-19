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
./scripts/ralph/ralph.sh --issue 42 15
```

This reads from `issues/42/tasks.json` and writes progress to `issues/42/progress.txt`.

### Standalone mode

Place a `prd.json` and optionally a `progress.txt` in the `scripts/ralph/` directory, then run:

```bash
./scripts/ralph/ralph.sh [max_iterations]
```

Default is 10 iterations.

### Options

| Flag | Description |
|------|-------------|
| `--issue N` | Issue number — reads artifacts from `issues/N/` instead of `scripts/ralph/` |
| `[number]` | Maximum iterations (default: `10`) |

### Examples

```bash
# Run 15 iterations for issue #42
./scripts/ralph/ralph.sh --issue 42 15

# Run 5 iterations in standalone mode
./scripts/ralph/ralph.sh 5

# Run with defaults (10 iterations, standalone mode)
./scripts/ralph/ralph.sh
```

## How It Works

1. Pick the highest priority story where `passes: false`
2. Implement that single story
3. Run quality checks (typecheck, tests)
4. Commit if checks pass
5. Update the task plan to mark story as `passes: true`
6. Append learnings to the progress log
7. Repeat until all stories pass or max iterations reached

When all stories are complete, Ralph exits with `<promise>COMPLETE</promise>`.

## Credits

Based on [Geoffrey Huntley's Ralph pattern](https://ghuntley.com/ralph/) and the [snarktank/ralph](https://github.com/snarktank/ralph) repository.
