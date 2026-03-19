# Agent Skills

Personal collection of [Agent Skills](https://agentskills.io) for GitHub issue management and resolution.

## Skills

| Skill | Description |
|-------|-------------|
| [`generate-gh-issue`](skills/generate-gh-issue/) | Generates architect-quality GitHub issues from short instructions with duplicate detection and label management. |
| [`resolve-gh-issue`](skills/resolve-gh-issue/) | Resolves a GitHub issue end-to-end: analysis, branch, PRD, task plan, and iterative implementation. Orchestrates all sub-skills. |
| [`analyze-issue`](skills/analyze-issue/) | Analyzes a GitHub issue to extract context, scope, affected areas, and complexity. |
| [`generate-prd`](skills/generate-prd/) | Generates a structured PRD with user stories, acceptance criteria, and functional requirements. |
| [`convert-prd-to-json`](skills/convert-prd-to-json/) | Converts a PRD markdown file into a structured JSON task plan for autonomous execution. |
| [`execute-tasks`](skills/execute-tasks/) | Iteratively implements user stories from a JSON task plan with quality checks and commits. |

## Quick Start

```
Resolve issue #42
```

See the [`resolve-gh-issue` README](skills/resolve-gh-issue/) for the complete pipeline documentation, or each skill's README for standalone usage.

## Requirements

- **GitHub CLI** (`gh`) — [install](https://cli.github.com/) and run `gh auth login`
- **Git** configured with push access to the repository

## Installation

### As a Claude Code Plugin

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
# GitHub shorthand
npx skills add fabioassuncao/agent-skills

# A specific skill only
npx skills add fabioassuncao/agent-skills --skill generate-gh-issue
```

### Manual

1. Download the desired skill folder from this repository.
2. Copy it into your project's `.claude/skills/` directory.

After installation, the skills are automatically available in any tool that supports Agent Skills.
