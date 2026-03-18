# Agent Skills

Personal collection of Agent Skills compatible with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other tools that support the Agent Skills format.

## Available Skills

| Skill | Description |
|-------|-------------|
| `generate-github-issue` | Generates detailed, architect-quality GitHub issues from short instructions. Analyzes the project's stack, architecture, and codebase before writing. Detects duplicates, validates labels, and publishes via `gh` CLI. |

## Installation

```bash
npx skills add fabioassuncao/agent-skills
```

After installation, the skills are automatically available in any tool that supports Agent Skills.
