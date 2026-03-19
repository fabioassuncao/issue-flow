# convert-prd-to-json

Converts a PRD markdown file into a structured JSON task plan suitable for autonomous iterative execution.

## Usage

```
Convert the PRD for issue #42 to a task plan
```

## Input / Output

- **Input:** `issues/prd-issue-{N}.md`
- **Output:** `issues/prd-issue-{N}.json`

### JSON Structure

```json
{
  "project": "project-name",
  "issueNumber": 42,
  "issueUrl": "https://github.com/owner/repo/issues/42",
  "branchName": "issue/42-slug",
  "description": "Feature description",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title",
      "description": "As a user, I want...",
      "acceptanceCriteria": ["Criterion 1", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Validations

- Flags and splits oversized stories (>6-7 acceptance criteria or multi-layer)
- Validates dependency order (schema > backend > UI)
- Ensures all stories start with `"passes": false`
- Ensures every story has "Typecheck passes" as acceptance criterion
- Archives stale task plans from previous branches

## Requirements

- An existing PRD file at `issues/prd-issue-{N}.md`
