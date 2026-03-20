# resolve-issue

Resolves a GitHub issue end-to-end: analyzes it, creates a dedicated branch, produces a PRD, converts it to an executable task plan, and iteratively implements each user story with commits.

## Usage

**By number:**
```
Resolve issue #42
```

**By URL:**
```
Resolve issue https://github.com/org/repo/issues/42
```

**Other trigger phrases:**
```
Fix this github issue: #87
Implement issue #15
Work on issue #42
```

## How It Works

The skill orchestrates 4 sub-skills through a phased pipeline:

```
Phase 0  → Checks for existing work in progress
Phase 1  → [analyze-issue]        Reads and analyzes the issue via gh CLI
Phase 2  → Creates branch          issue/{number}-{slug}
Phase 3a → [generate-prd]         Generates PRD in issues/{N}/prd.md
Phase 3b → [convert-prd-to-json]  Converts to issues/{N}/tasks.json
Phase 3c → Awaits confirmation     Presents the plan and asks for "yes" to continue
Phase 4  → [execute-tasks]        Implements each user story with commits
```

> The skill **pauses and awaits confirmation** before starting implementation. You will see the complete plan before any code is written.

## Resuming Work in Progress

If you already started working on an issue, invoking the skill again will detect existing work and ask:

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

## Generated Files

```
issues/
└── {N}/
    ├── prd.md                  # PRD (human-readable)
    ├── tasks.json              # Task plan (machine-readable)
    ├── progress.txt            # Progress log
    └── archive/                # Archived previous runs
```

## Sub-Skills

Each sub-skill can also be used independently:

| Skill | Command |
|-------|---------|
| [analyze-issue](../analyze-issue/) | `Analyze issue #42` |
| [generate-prd](../generate-prd/) | `Generate a PRD for issue #42` |
| [convert-prd-to-json](../convert-prd-to-json/) | `Convert the PRD for issue #42 to a task plan` |
| [execute-tasks](../execute-tasks/) | `Execute the task plan for issue #42` |

## Requirements

- **GitHub CLI** (`gh`) authenticated with the repository
- **Git** configured with push access
- Repository with a `main` or `master` branch
