# Agent Skills

Personal collection of Agent Skills compatible with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other tools that support the Agent Skills format.

## Available Skills

| Skill | Description |
|-------|-------------|
| `generate-github-issue` | Generates detailed, architect-quality GitHub issues from short instructions. Analyzes the project's stack, architecture, and codebase before writing. Detects duplicates, validates labels, and publishes via `gh` CLI. |

## Installation

### Using [skills.sh](https://skills.sh/)

```bash
# GitHub shorthand (owner/repo)
npx skills add fabioassuncao/agent-skills

# Full GitHub URL
npx skills add https://github.com/fabioassuncao/agent-skills

# A specific skill only
npx skills add fabioassuncao/agent-skills --skill generate-github-issue
```

### Manual

1. Download the desired skill folder from this repository.
2. Copy it into your project's `.claude/skills/` directory.

After installation, the skills are automatically available in any tool that supports Agent Skills.