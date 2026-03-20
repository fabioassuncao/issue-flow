---
name: resolve-issue
description: "Resolve a GitHub issue end-to-end: analyze it, create a dedicated branch, produce a detailed PRD, convert it to an executable task plan (JSON), and iteratively implement each user story with commits. Trigger this skill whenever the user mentions resolving, fixing, working on, or implementing a GitHub issue, provides an issue number or URL, or says something like \"resolve issue #42\", \"work on issue\", \"implement this issue\", or \"fix this github issue\". Always use this skill instead of trying to resolve issues manually."
compatibility: Requires gh CLI (https://cli.github.com/) and git
allowed-tools: Bash Read Write Skill(analyze-issue) Skill(generate-prd) Skill(convert-prd-to-json) Skill(execute-tasks)
---

# Resolve GitHub Issue

You are an autonomous agent responsible for resolving a GitHub issue from start to finish.

## Orchestration Rules

This skill orchestrates a pipeline of sub-skills. Follow these rules:
- **Proceed automatically** between phases when there are no ambiguities or decisions needed.
- **Stop only when** there is a genuine decision the user must make (ambiguity, error, or the pre-execution choice in Step 3c).
- When stopping, **always present options with a recommended choice** so the user can decide quickly.
- Do NOT ask "shall I proceed?" or "ready to continue?" between phases — just proceed.
- Each sub-skill may surface ambiguities. If there are none, move to the next phase immediately.

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
   - `issues/{ISSUE_NUMBER}/prd.md`
   - `issues/{ISSUE_NUMBER}/tasks.json`
   - `issues/{ISSUE_NUMBER}/progress.txt`
3. **If files exist**, read `issues/{ISSUE_NUMBER}/tasks.json` and check:
   - What is the top-level `issueStatus`?
   - How many user stories have `"passes": true` vs `"passes": false`?
   - Read `issues/{ISSUE_NUMBER}/progress.txt` to understand what was done
   - Cross-check completed stories against actual git commits (`git log --oneline`)
4. **If in-progress work is detected**, report the status to the user:
```
Found existing work for issue #{ISSUE_NUMBER}:
- Branch: issue/{ISSUE_NUMBER}-{slug}
- Issue status: pending | in_progress | completed
- Progress: X of Y user stories completed
- Last commit: [commit message]

Would you like to:
A. Continue from where we left off
B. Start fresh (will archive existing files)
C. Cancel
```

Wait for the user's choice before proceeding. **Never silently overwrite existing work.**

If the user chooses **B (Start fresh)**:
- Archive existing files: `mkdir -p issues/{ISSUE_NUMBER}/archive && cp -f issues/{ISSUE_NUMBER}/prd.md issues/{ISSUE_NUMBER}/tasks.json issues/{ISSUE_NUMBER}/progress.txt issues/{ISSUE_NUMBER}/archive/ 2>/dev/null || true`
- Delete originals: `rm -f issues/{ISSUE_NUMBER}/prd.md issues/{ISSUE_NUMBER}/tasks.json issues/{ISSUE_NUMBER}/progress.txt`
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

If the analysis reveals no critical ambiguities, **immediately proceed to Phase 2**.
If there are ambiguities:
1. Present them to the user with recommended answers.
2. After the user responds, **merge those clarifications back into `ISSUE_ANALYSIS` before proceeding**.
3. Update the relevant sections of `ISSUE_ANALYSIS` so downstream skills see the clarified intent:
   - Add a `User Clarifications` section summarizing the user's answers
   - Rewrite any affected summary, scope, or technical notes to reflect those answers
   - Remove resolved items from `Ambiguities`, leaving only anything still genuinely unresolved
4. Carry this revised `ISSUE_ANALYSIS` forward to Phase 2 and Phase 3.

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

**→ Immediately proceed to Phase 3.**

---

## Phase 3: Generate PRD and Task Plan

### Step 3a — Generate PRD

**Use the Skill tool to invoke: `generate-prd`**

Pass as context:
- `ISSUE_NUMBER`
- `ISSUE_ANALYSIS` (the revised Phase 1 analysis, including any merged user clarifications)
- `BRANCH_NAME`
- Output path: `issues/{ISSUE_NUMBER}/prd.md`

The skill may ask follow-up questions only for ambiguities that remain unresolved after Phase 1.
**Do NOT implement anything yet. The PRD skill handles this step entirely.**

After the PRD skill completes and `issues/{ISSUE_NUMBER}/prd.md` exists, **immediately proceed to Step 3b**, even if the PRD still contains explicitly documented open questions that do not block planning.

### Step 3b — Convert PRD to JSON

**Use the Skill tool to invoke: `convert-prd-to-json`**

Pass as context:
- Input path: `issues/{ISSUE_NUMBER}/prd.md`
- Output path: `issues/{ISSUE_NUMBER}/tasks.json`
- Validation requirements: stories ordered by dependency, each with "Typecheck passes", UI stories with browser verification

Store the parsed user stories list as `TASK_PLAN`.

**→ Immediately proceed to Step 3c.**

### Step 3c — Confirm Before Development Starts

Present the task plan summary and ask only whether the user wants to start development now:

```
📋 Task plan for issue #{ISSUE_NUMBER}:

Branch: issue/{ISSUE_NUMBER}-{slug}
User stories ({N} total):
  US-001: [title] — {N} acceptance criteria
  US-002: [title] — {N} acceptance criteria
  ...

Do you want to proceed with development now?

A. **Proceed now** (recommended) — invoke `execute-tasks` and start implementing the stories in this session
B. **Stop here for now** — keep the generated artifacts and end the flow without starting development

Choose A or B:
```

Wait for the user's choice.

#### If user chooses A:
Proceed to Phase 4.

#### If user chooses B:
Preserve the generated artifacts and **stop** — do NOT invoke `execute-tasks`. Tell the user they can resume later manually with `resolve-issue` or `execute-tasks`, or optionally run Ralph on their own:

```
✅ Planning artifacts saved. Development has not started.

Artifacts kept:
  - issues/{ISSUE_NUMBER}/prd.md
  - issues/{ISSUE_NUMBER}/tasks.json
  - Branch: issue/{ISSUE_NUMBER}-{slug}

You can resume later by:
  - Running `resolve-issue` again for issue #{ISSUE_NUMBER}
  - Running `execute-tasks` directly for issue #{ISSUE_NUMBER}

Optional autonomous path:
  ./scripts/ralph/ralph.sh --issue {ISSUE_NUMBER} 15
```

---

## Phase 4: Execute Tasks Iteratively

**Use the Skill tool to invoke: `execute-tasks`**

Pass as context:
- `ISSUE_NUMBER`
- `TASK_PLAN` path: `issues/{ISSUE_NUMBER}/tasks.json`
- `PROGRESS_LOG` path: `issues/{ISSUE_NUMBER}/progress.txt`
- `BRANCH_NAME`

Enter this phase after the user chose "Execute now" in Step 3c, or "Continue" in Phase 0.

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
└── {ISSUE_NUMBER}/
    ├── prd.md           # PRD (human-readable)
    ├── tasks.json       # Task plan (machine-readable)
    ├── progress.txt     # Progress log
    └── archive/         # Archived previous runs
```

---

## Important Rules

- **Proceed automatically between phases unless a genuine decision is needed**
- **When stopping for a decision, always present options with a recommended choice**
- **Never overwrite existing in-progress work without asking**
- **One story per iteration** — don't batch multiple stories
- **All commits must pass quality checks** — no broken code
- **Always read `issues/{ISSUE_NUMBER}/progress.txt` before entering Phase 4** to understand what was done and what patterns were discovered
- **Each skill invocation is a delegation** — wait for the skill to fully complete before moving to the next phase
- **Never execute Ralph automatically** — it is an opt-in advanced option shown only as information after the user decides not to start development
- **If the user chooses not to proceed in Step 3c, stop cleanly and preserve all generated artifacts**
