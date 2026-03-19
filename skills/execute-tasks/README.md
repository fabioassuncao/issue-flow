# execute-tasks

Iteratively implements user stories from a JSON task plan, committing after each passing story and updating progress.

## Usage

```
Execute the task plan for issue #42
```

## How It Works

For each user story (in priority order):

1. **Pick** the highest-priority story where `passes: false`
2. **Understand** the story and explore the codebase
3. **Implement** the code changes
4. **Run quality checks** (typecheck, lint, tests)
5. **Browser verification** (for UI stories, using playwright-cli or playwright MCP)
6. **Commit** with `feat: [Story ID] - [Story Title]`
7. **Update** the JSON task plan (`passes: true`)
8. **Log** progress to `issues/{N}/progress.txt`
9. **Repeat** until all stories pass

## Progress Tracking

The skill maintains:

- **Task plan** (`issues/{N}/tasks.json`) — updated after each story
- **Progress log** (`issues/{N}/progress.txt`) — append-only log with changes, files modified, and learnings
- **Codebase patterns** — reusable patterns discovered during implementation, stored at the top of the progress log

## Error Recovery

- If quality checks fail after multiple attempts, the skill documents the blocker and asks for guidance
- If a story turns out to be fundamentally different from planned, the skill stops and proposes a revised breakdown

## Requirements

- An existing JSON task plan at `issues/{N}/tasks.json`
- Git configured with a working branch
