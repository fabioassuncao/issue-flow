# Agent Skills

Personal collection of Agent Skills compatible with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugins and other tools that support the Agent Skills format.

## Available Skills

| Skill | Description |
|-------|-------------|
| `generate-gh-issue` | Generates detailed, architect-quality GitHub issues from short instructions. Analyzes the project's stack, architecture, and codebase before writing. Detects duplicates, validates labels, and publishes via `gh` CLI. |
| `resolve-gh-issue` | Resolves a GitHub issue end-to-end: analyzes it, creates a branch, produces a PRD, converts it to a task plan, and implements each user story with commits. Orchestrates all sub-skills automatically. |
| `analyze-issue` | Fetches and analyzes a GitHub issue to extract context, scope, affected areas, and complexity before planning implementation. |
| `generate-prd` | Generates a structured PRD with user stories, acceptance criteria, and functional requirements from a GitHub issue analysis. |
| `convert-prd-to-json` | Converts a PRD markdown file into a structured JSON task plan suitable for autonomous iterative execution. |
| `execute-tasks` | Iteratively implements user stories from a JSON task plan, committing after each passing story and updating progress. |

## GitHub Issue Resolution Flow

The `resolve-gh-issue` skill orchestrates a complete issue-to-implementation pipeline. Each sub-skill can also be used independently.

### Skill Structure

```
skills/
├── resolve-gh-issue/   ← main skill (orchestrator)
│   └── SKILL.md
├── analyze-issue/           ← analyzes the issue and extracts context
│   └── SKILL.md
├── generate-prd/            ← generates the PRD in Markdown
│   └── SKILL.md
├── convert-prd-to-json/     ← converts PRD to a JSON task plan
│   └── SKILL.md
└── execute-tasks/           ← implements user stories iteratively
    └── SKILL.md
```

### Quick Start: Full Flow

The simplest way is to use the main skill. It manages the entire issue lifecycle automatically.

**By number:**
```
Resolve issue #42
```

**Trigger phrases:**
```
Fix this github issue: #87
Implement issue #15
Resolve issue https://github.com/org/repo/issues/15
```

### What Happens Automatically

```
Phase 0  → Checks for existing work in progress
Phase 1  → [analyze-issue]        Reads and analyzes the issue via gh CLI
Phase 2  → Creates branch          issue/{number}-{slug}
Phase 3a → [generate-prd]         Generates PRD in issues/prd-issue-{N}.md
Phase 3b → [convert-prd-to-json]  Converts to issues/prd-issue-{N}.json
Phase 3c → Awaits confirmation     Presents the plan and asks for "yes" to continue
Phase 4  → [execute-tasks]        Implements each user story with commits
```

> The skill **pauses and awaits confirmation** before starting implementation. You will see the complete plan before any code is written.

### Resuming Work in Progress

If you already started working on an issue and want to continue:

```
Resolve issue #42
```

The skill detects existing work and asks:

```
Found existing work for issue #42:
- Branch: issue/42-add-user-auth
- Progress: 2 of 5 user stories completed
- Last commit: feat: US-002 - Setup JWT middleware

Would you like to:
A. Continue from where we left off
B. Start fresh (will archive existing files)
C. Cancel
```

### Using Sub-Skills Individually

Each sub-skill can be invoked directly when you don't need the full flow.

#### `analyze-issue` — Analyze an Issue

Useful to understand scope before deciding what to do.

```
Analyze issue #42
```
```
What's the scope of issue #42?
```

**Output:** title, description, labels, affected modules, tech stack, complexity estimate, ambiguities.

#### `generate-prd` — Generate the PRD

Useful when you already have the analysis and want to generate documentation before implementing.

```
Generate a PRD for issue #42
```

**Output:** file `issues/prd-issue-{N}.md` with user stories, acceptance criteria, and technical context.

> If the issue is ambiguous, the skill will ask clarifying questions before generating the document.

#### `convert-prd-to-json` — Convert PRD to Task Plan

Useful when the PRD already exists and you want to generate (or regenerate) the JSON plan.

```
Convert the PRD for issue #42 to a task plan
```

**Output:** file `issues/prd-issue-{N}.json` with user stories ordered by dependency, each with acceptance criteria and a `passes` flag.

#### `execute-tasks` — Execute the Tasks

Useful when the JSON plan already exists and you want to start or resume implementation.

```
Execute the task plan for issue #42
```

**Behavior:** executes one user story at a time, runs quality checks, commits, and updates the JSON before moving to the next.

### Generated Files

```
issues/
├── prd-issue-{N}.md            # PRD (human-readable)
├── prd-issue-{N}.json          # Task plan (machine-readable)
├── progress-issue-{N}.txt      # Progress log
└── archive/
    └── issue-{N}/              # Archived previous runs
```

### Quick Reference

| What you want to do | Command |
|---|---|
| Resolve an issue from scratch | `Resolve issue #42` |
| Only understand the scope | `Analyze issue #42` |
| Only generate the PRD | `Generate a PRD for issue #42` |
| Only convert PRD to JSON | `Convert the PRD for issue #42 to a task plan` |
| Only execute planned tasks | `Execute the task plan for issue #42` |
| Resume work in progress | `Resolve issue #42` (the skill detects and asks) |

### Requirements

- **GitHub CLI** (`gh`) authenticated with the repository
- **Git** configured with push access
- Repository with a `main` or `master` branch

## Installation

### As a Claude Code Plugin

First, add the marketplace, then install the plugin:

```bash
# 1. Add the marketplace
/plugin marketplace add fabioassuncao/agent-skills

# 2. Install the plugin
/plugin install agent-skills@agent-skills-marketplace
```

Once installed, skills are namespaced under `agent-skills:` (e.g., `/agent-skills:resolve-gh-issue`).

To test locally during development:

```bash
claude --plugin-dir ./agent-skills
```

### Using [skills.sh](https://skills.sh/)

```bash
# GitHub shorthand (owner/repo)
npx skills add fabioassuncao/agent-skills

# Full GitHub URL
npx skills add https://github.com/fabioassuncao/agent-skills

# A specific skill only
npx skills add fabioassuncao/agent-skills --skill generate-gh-issue
```

### Manual

1. Download the desired skill folder from this repository.
2. Copy it into your project's `.claude/skills/` directory.

After installation, the skills are automatically available in any tool that supports Agent Skills.
