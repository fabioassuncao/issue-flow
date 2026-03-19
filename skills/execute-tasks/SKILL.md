---
name: execute-tasks
description: Iteratively implement user stories from issues/prd-issue-{N}.json, committing after each passing story and updating the task plan. Follows the Ralph autonomous agent pattern.
---

# Execute Tasks (Autonomous Agent)

You are an autonomous coding agent. Work on one user story at a time, commit it, and repeat.

---

## Before Starting Each Iteration

1. **Read the task plan**: `issues/prd-issue-{ISSUE_NUMBER}.json`
2. **Read the progress log**: `issues/progress-issue-{ISSUE_NUMBER}.txt`
   - Pay special attention to the `## Codebase Patterns` section at the top
   - These are hard-won learnings from previous iterations — don't repeat mistakes
3. **Read `CLAUDE.md`** if it exists (project conventions)
4. **Verify you're on the right branch**: `git branch --show-current`
   - Should match `branchName` from the JSON
   - If not, check it out: `git checkout issue/{ISSUE_NUMBER}-{slug}`

---

## The Iteration Loop

### Step 1: Pick the Next Story

Select the **highest priority** story where `"passes": false`.

Priority 1 comes before priority 2, etc.

### Step 2: Understand the Story

Read the story's:
- `description` — the user story
- `acceptanceCriteria` — what "done" means (these are your definition of done)

Explore the codebase as needed to understand:
- Where to make changes
- What existing patterns to follow
- What files are affected

### Step 3: Implement

Make the necessary code changes to satisfy all acceptance criteria.

**Rules:**
- Follow existing code patterns — don't invent new conventions
- Keep changes focused and minimal — only change what's needed for this story
- If you discover the story is larger than expected, implement the minimum to pass all criteria

### Step 4: Run Quality Checks

Run whatever quality checks this project uses. Common examples:

```bash
# TypeScript projects
npx tsc --noEmit

# JavaScript/TypeScript linting
npx eslint . --ext .ts,.tsx,.js,.jsx

# Running tests
npm test
# or
npx vitest run
# or
npx jest

# Python projects
mypy .
ruff check .
pytest

# Rust
cargo check
cargo clippy
cargo test
```

Check `package.json` scripts or `CLAUDE.md` to find the right commands.

**Do NOT commit if checks fail.** Fix the issues first.

### Step 5: Browser Verification (If Required)

If the story's acceptance criteria includes "Verify in browser using playwright-cli if available; otherwise use the playwright MCP/skill":

1. Prefer `playwright-cli` for browser verification when it is available in this environment.
2. If `playwright-cli` is not available, use the `playwright` MCP/skill instead.
3. Start the dev server if not running.
4. Navigate to the relevant page.
5. Interact with the UI change.
6. Confirm it works as specified in the acceptance criteria.
7. Note which tool you used and what you verified in the progress log.

If browser tools aren't available, note in the progress log that manual browser verification is needed.

### Step 6: Commit

Once all quality checks pass:

```bash
git add -A
git commit -m "feat: [Story ID] - [Story Title]"
```

Example: `feat: US-002 - Display status badge on task cards`

### Step 7: Update the Task Plan

Update `issues/prd-issue-{ISSUE_NUMBER}.json`:
- Set `"passes": true` for the completed story
- Add any relevant notes to `"notes"` field (e.g., "Found that X pattern was needed")

```bash
# Verify the JSON is still valid after editing
cat issues/prd-issue-{ISSUE_NUMBER}.json | python3 -m json.tool > /dev/null
```

### Step 8: Append to Progress Log

**Always append, never replace** `issues/progress-issue-{ISSUE_NUMBER}.txt`:

```
## [ISO datetime] - [Story ID]: [Story Title]

### What was implemented
[Brief description of changes]

### Files changed
- path/to/file.ts — [what changed]
- path/to/another.ts — [what changed]

### Learnings for future iterations
- [Pattern discovered, e.g., "This codebase uses X for Y"]
- [Gotcha encountered, e.g., "Must update Z when changing W"]
- [Useful context, e.g., "The evaluation panel lives in component X"]

---
```

### Step 9: Update Codebase Patterns (If Applicable)

If you discovered a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the **top** of `issues/progress-issue-{ISSUE_NUMBER}.txt`.

Create the section if it doesn't exist yet:

```
## Codebase Patterns
- [Pattern]: [Brief explanation]
- [Another pattern]: [Brief explanation]
```

Only add patterns that are **general and reusable across stories**, not story-specific details.

### Step 10: Update CLAUDE.md (If Applicable)

Before finishing, check if any edited directories have a `CLAUDE.md`. If you discovered something genuinely useful for future work in that directory:

- API patterns or conventions specific to that module
- Non-obvious dependencies between files
- Testing requirements for that area
- Configuration gotchas

**Do NOT add:**
- Story-specific details
- Temporary debugging notes
- Anything already in the progress log

---

## Progress Log Format

The first time you write to the progress log, create it with this header:

```
# Progress Log — Issue #{ISSUE_NUMBER}

## Codebase Patterns
[Fill in as patterns are discovered]

---

[Individual story entries will follow]
```

---

## Stop Condition

After completing each story, check: **are all stories now `"passes": true`?**

**If YES — all stories complete:**
```
<promise>COMPLETE</promise>
```

Then provide a final summary:
```
✅ Issue #{ISSUE_NUMBER} fully resolved!

Completed {N} user stories:
  ✅ US-001: [title]
  ✅ US-002: [title]
  ...

Branch: issue/{ISSUE_NUMBER}-{slug}
Ready to open a PR.
```

**If NO — stories remain:**
End your response normally. The next invocation will pick up the next story.

---

## Error Recovery

If quality checks fail after multiple attempts:
1. Document what you tried in the progress log
2. Set `"notes"` in the JSON to explain the blocker
3. Ask the user for guidance before proceeding

If you realize the story is fundamentally different from what was planned:
1. Stop and ask the user before making large changes
2. Propose a revised story breakdown if needed

---

## Important Rules

- **Work on ONE story per iteration** — never batch multiple stories in one commit
- **Never commit broken code** — always pass quality checks first
- **Always append to the progress log** — never overwrite it
- **Always read `## Codebase Patterns`** before starting — don't repeat previous mistakes
- **Keep changes minimal** — don't refactor unrelated code while implementing a story
