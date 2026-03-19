# analyze-issue

Fetches and analyzes a GitHub issue to extract context, scope, affected areas, and complexity before planning implementation.

## Usage

```
Analyze issue #42
```

```
What's the scope of issue #42?
```

## Output

The skill produces a structured analysis with:

- **Issue Summary** — title, goal, reporter context, type (bug/feature/refactor/docs/performance)
- **Scope Assessment** — affected areas, complexity estimate (Simple/Medium/Complex), dependencies
- **Technical Notes** — constraints, existing code patterns, files likely to be modified, gotchas
- **Ambiguities** — unclear aspects that need clarification before proceeding

If critical ambiguities are found, the skill asks 1-3 clarifying questions before proceeding.

## Requirements

- **GitHub CLI** (`gh`) authenticated with the repository
- **Git** configured inside a repo with a GitHub remote
