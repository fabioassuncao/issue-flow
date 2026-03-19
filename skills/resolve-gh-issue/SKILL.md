---
name: resolve-gh-issue
description: "Resolve a GitHub issue end-to-end: analyze it, create a dedicated branch, produce a detailed PRD, convert it to an executable task plan (JSON), and iteratively implement each user story with commits. Trigger this skill whenever the user mentions resolving, fixing, working on, or implementing a GitHub issue, provides an issue number or URL, or says something like \"resolve issue #42\", \"work on issue\", \"implement this issue\", or \"fix this github issue\". Always use this skill instead of trying to resolve issues manually."
compatibility: Requires gh CLI (https://cli.github.com/) and git
allowed-tools: Bash Read Write Skill(analyze-issue) Skill(generate-prd) Skill(convert-prd-to-json) Skill(execute-tasks)
---

# Resolve GitHub Issue

You are an autonomous agent responsible for resolving a GitHub issue from start to finish.

---

## Entry Point

The user will provide either:
- An issue number (e.g., `42`)
- A full GitHub issue URL (e.g., `https://github.com/org/repo/issues/42`)

Extract `ISSUE_NUMBER` from whichever format is given.

---

## Phase 0: Check for Existing Work in Progress

**Before anything else**, check if there's already work in progress for this or any issue:

1. **Check current branch**: Run `git branch --show-current`. If it matches `issue/{ISSUE_NUMBER}-*`, work may already be in progress.
2. **Check for existing task files**:
   - `issues/prd-issue-{ISSUE_NUMBER}.md`
   - `issues/prd-issue-{ISSUE_NUMBER}.json`
   - `issues/progress-issue-{ISSUE_NUMBER}.txt`
3. **If files exist**, read `issues/prd-issue-{ISSUE_NUMBER}.json` and check:
   - How many user stories have `"passes": true` vs `"passes": false`?
   - Read `issues/progress-issue-{ISSUE_NUMBER}.txt` to understand what was done
   - Cross-check completed stories against actual git commits (`git log --oneline`)
4. **If in-progress work is detected**, report the status to the user:
```
Found existing work for issue #{ISSUE_NUMBER}:
- Branch: issue/{ISSUE_NUMBER}-{slug}
- Progress: X of Y user stories completed
- Last commit: [commit message]

Would you like to:
A. Continue from where we left off
B. Start fresh (will archive existing files)
C. Cancel
```

Wait for the user's choice before proceeding. **Never silently overwrite existing work.**

If the user chooses **B (Start fresh)**:
- Archive existing files: `mkdir -p issues/archive/issue-{ISSUE_NUMBER} && cp -f issues/prd-issue-{ISSUE_NUMBER}.md issues/prd-issue-{ISSUE_NUMBER}.json issues/progress-issue-{ISSUE_NUMBER}.txt issues/archive/issue-{ISSUE_NUMBER}/ 2>/dev/null || true`
- Delete originals: `rm -f issues/prd-issue-{ISSUE_NUMBER}.md issues/prd-issue-{ISSUE_NUMBER}.json issues/progress-issue-{ISSUE_NUMBER}.txt`
- Proceed from Phase 1

If the user chooses **A (Continue)**:
- Skip to Phase 4 (Execute Tasks)

---

## Phase 1: Analyze the Issue

**Use the Skill tool to invoke: `analyze-issue`**

Pass as context:
- `ISSUE_NUMBER`: the extracted issue number
- Expected output: issue title, body, labels, affected modules, tech stack summary, complexity estimate

Store the result in memory as `ISSUE_ANALYSIS` — you will pass it to subsequent skills.

---

## Phase 2: Create Branch

Create a working branch for this issue:
```bash
ISSUE_TITLE=$(gh issue view {ISSUE_NUMBER} --json title -q '.title')
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g' | cut -c1-50)
BRANCH_NAME="issue/{ISSUE_NUMBER}-${SLUG}"

git checkout main 2>/dev/null || git checkout master
git pull
git checkout -b "$BRANCH_NAME"
```

Inform the user: `Created branch: issue/{ISSUE_NUMBER}-{slug}`

Store `BRANCH_NAME` — you will reference it in later phases.

---

## Phase 3: Generate PRD and Task Plan

### Step 3a — Generate PRD

**Use the Skill tool to invoke: `generate-prd`**

Pass as context:
- `ISSUE_NUMBER`
- `ISSUE_ANALYSIS` (from Phase 1)
- `BRANCH_NAME`
- Output path: `issues/prd-issue-{ISSUE_NUMBER}.md`

The skill will handle clarifying questions with the user if the issue is ambiguous.
**Do NOT implement anything yet. Wait for the skill to complete.**

### Step 3b — Convert PRD to JSON

**Use the Skill tool to invoke: `convert-prd-to-json`**

Pass as context:
- Input path: `issues/prd-issue-{ISSUE_NUMBER}.md`
- Output path: `issues/prd-issue-{ISSUE_NUMBER}.json`
- Validation requirements: stories ordered by dependency, each with "Typecheck passes", UI stories with browser verification

Store the parsed user stories list as `TASK_PLAN`.

### Step 3c — Confirm Before Proceeding

Present the task plan to the user and **ask for explicit confirmation**:
```
📋 Task plan created for issue #{ISSUE_NUMBER}:

Branch: issue/{ISSUE_NUMBER}-{slug}
User stories ({N} total):
  US-001: [title] — {N} acceptance criteria
  US-002: [title] — {N} acceptance criteria
  ...

Ready to start implementing. This will:
- Implement each story one at a time
- Run quality checks after each story  
- Commit code as each story passes

Proceed with implementation? (yes/no)
```

**Wait for explicit "yes" before continuing. Do not proceed if the user says no or is unclear.**

---

## Phase 4: Execute Tasks Iteratively

**Use the Skill tool to invoke: `execute-tasks`**

Pass as context:
- `ISSUE_NUMBER`
- `TASK_PLAN` path: `issues/prd-issue-{ISSUE_NUMBER}.json`
- `PROGRESS_LOG` path: `issues/progress-issue-{ISSUE_NUMBER}.txt`
- `BRANCH_NAME`

Only enter this phase after receiving explicit confirmation from the user (or if the user chose "Continue" in Phase 0).

The `execute-tasks` skill will run its own loop:
1. Pick the highest-priority story where `passes: false`
2. Implement it
3. Run quality checks
4. Commit with: `feat: [Story ID] - [Story Title]`
5. Update `passes: true` in the JSON
6. Append to the progress log
7. Repeat until all stories pass

When `execute-tasks` reports completion, output:
```
<promise>COMPLETE</promise>
```

---

## File Structure
```
issues/
├── prd-issue-{ISSUE_NUMBER}.md       # PRD (human-readable)
├── prd-issue-{ISSUE_NUMBER}.json     # Task plan (machine-readable)
├── progress-issue-{ISSUE_NUMBER}.txt   # Progress log
└── archive/
    └── issue-{ISSUE_NUMBER}/           # Archived previous runs
```

---

## Important Rules

- **Never proceed past Phase 3c without explicit user confirmation**
- **Never overwrite existing in-progress work without asking**
- **One story per iteration** — don't batch multiple stories
- **All commits must pass quality checks** — no broken code
- **Always read `issues/progress-issue-{ISSUE_NUMBER}.txt` before entering Phase 4** to understand what was done and what patterns were discovered
- **Each skill invocation is a delegation** — wait for the skill to fully complete before moving to the next phase
