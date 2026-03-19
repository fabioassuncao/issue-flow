---
name: analyze-issue
description: Fetch and analyze a GitHub issue to extract context, scope, affected areas, and complexity before planning implementation.
---

# Analyze GitHub Issue

## The Job

Fetch a GitHub issue and produce a structured analysis that will inform the PRD and task plan.

---

## Step 1: Fetch Issue Data

```bash
gh issue view {ISSUE_NUMBER} \
  --json title,body,labels,assignees,milestone,comments,state,url \
  --repo {owner}/{repo}
```

If the repo can be inferred from the current directory's git remote, use it. Otherwise, ask the user.

Also fetch any linked PRs or referenced issues if mentioned in the body.

---

## Step 2: Understand the Codebase Context

Before analyzing the issue, orient yourself in the codebase:

1. Read `CLAUDE.md` if it exists (project conventions, patterns, setup)
2. Identify the tech stack from `package.json`, `pyproject.toml`, `Cargo.toml`, etc.
3. Identify the testing setup: `jest`, `vitest`, `pytest`, `cargo test`, etc.
4. Identify the linting/typecheck commands available

---

## Step 3: Produce Analysis

Generate a structured analysis with these sections:

### Issue Summary
- **Title**: Issue title
- **Goal**: What problem is being solved or what feature is being added?
- **Reporter context**: Any important context from comments or issue body
- **Type**: bug / feature / refactor / docs / performance

### Scope Assessment
- **Affected areas**: Which modules, files, or systems will likely be touched?
- **Complexity**: Simple (1-2 stories) / Medium (3-5 stories) / Complex (6+ stories)
- **Dependencies**: Does this depend on other issues or external services?

### Technical Notes
- Known constraints
- Relevant existing code patterns that should be followed
- Files likely to be modified (best guess based on codebase exploration)
- Potential gotchas or non-obvious considerations

### Ambiguities
- List anything unclear that needs clarification before writing the PRD
- Flag if the issue scope is too broad and should be split

---

## Output

Print the analysis to the user and confirm before proceeding to PRD generation.

If there are critical ambiguities, ask the user to clarify before proceeding. Keep it to 1-3 questions maximum.
