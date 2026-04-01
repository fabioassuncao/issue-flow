# ralph-agent

Autonomous AI agent loop that runs [Claude Code](https://docs.anthropic.com/en/docs/claude-code) iteratively until all task plan stories are complete. Each iteration is a fresh Claude instance with clean context. Memory persists via git history, `progress.txt`, and the task plan JSON.

This is the TypeScript CLI replacement for `scripts/ralph/ralph.sh`, offering type safety, modular architecture, and npm-based distribution.

## Requirements

- **Node.js** >= 18.0.0
- **git** installed and available in PATH
- **Claude Code** (`npm install -g @anthropic-ai/claude-code`)

> **Note:** Unlike the Bash version, `jq` is NOT required. JSON manipulation is handled natively by TypeScript.

## Installation

```bash
# Run directly via npx (no install needed)
npx ralph-agent --issue 42

# Or install globally
npm install -g ralph-agent
ralph-agent --issue 42
```

## Usage

```bash
# Run for a specific issue (recommended)
npx ralph-agent --issue 42

# Limit iterations
npx ralph-agent --issue 42 --max-iterations 15

# Retry transient failures forever
npx ralph-agent --issue 42 --retry-forever

# Custom retry limit
npx ralph-agent --issue 42 --retry-limit 20

# Standalone mode (uses prd.json in project root)
npx ralph-agent --max-iterations 5

# Backward-compatible positional argument
npx ralph-agent 5

# Show help
npx ralph-agent --help
```

## Options

| Flag | Description |
|------|-------------|
| `--issue N` | Issue number -- reads artifacts from `issues/N/` |
| `--max-iterations N` | Stop after N iterations (default: unlimited) |
| `--retry-limit N` | Retry transient Claude failures up to N consecutive times (default: 10) |
| `--retry-forever` | Retry transient Claude failures indefinitely |
| `[number]` | Backward-compatible alias for `--max-iterations N` |

## How It Works

1. Load `tasks.json` (from `issues/{N}/` or project root)
2. Initialize state and validate dependencies
3. Resolve `prompt.md` (local or remote download)
4. For each iteration:
   - Replace placeholders in prompt template
   - Execute Claude CLI with the prompt
   - Handle results (success, transient failure, fatal failure)
   - Detect `<promise>COMPLETE</promise>` signal
5. Track progress and print summary

## Architecture

```
src/
  cli.ts                  # Entry point, argument parsing (commander)
  config.ts               # Configuration resolution and defaults
  types.ts                # Shared TypeScript interfaces
  core/
    engine.ts             # Main loop orchestrating all modules
    executor.ts           # Claude CLI invocation via execa
    state-manager.ts      # Typed CRUD for tasks.json
    prompt-resolver.ts    # Prompt resolution and templating
  ui/
    logger.ts             # Colored logging utilities
    progress.ts           # Progress bar and iteration headers
    summary.ts            # Box drawing and summary display
  utils/
    shell.ts              # Shell command execution
    git.ts                # Git operations
    retry.ts              # Transient failure detection and backoff
```

## Migrating from ralph.sh

The TypeScript CLI is a drop-in replacement for `scripts/ralph/ralph.sh`. All flags, behavior, and file formats are identical:

| Bash | TypeScript |
|------|-----------|
| `./scripts/ralph/ralph.sh --issue 42` | `npx ralph-agent --issue 42` |
| `./scripts/ralph/ralph.sh --max-iterations 10` | `npx ralph-agent --max-iterations 10` |
| `./scripts/ralph/ralph.sh --retry-forever` | `npx ralph-agent --retry-forever` |
| `./scripts/ralph/ralph.sh 5` | `npx ralph-agent 5` |

### Key differences

- **No `jq` dependency** -- JSON is handled natively
- **No `curl | bash` needed** -- install and run via `npx`
- **Atomic JSON writes** -- uses write-to-temp + rename to prevent corruption
- **Type safety** -- all tasks.json operations are validated at compile time

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Run tests
npm test

# Watch mode
npm run dev
```

For the full development setup, local testing, and NPM publishing guide, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Based on [Geoffrey Huntley's Ralph pattern](https://ghuntley.com/ralph/) and the [snarktank/ralph](https://github.com/snarktank/ralph) repository.
