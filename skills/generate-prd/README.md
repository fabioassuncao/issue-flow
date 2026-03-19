# generate-prd

Generates a structured Product Requirements Document (PRD) from a GitHub issue analysis, with user stories, acceptance criteria, and functional requirements.

## Usage

```
Generate a PRD for issue #42
```

## Output

Saves to `issues/prd-issue-{N}.md` with:

- Introduction / Overview
- Goals
- User Stories (small, dependency-ordered, with acceptance criteria)
- Functional Requirements
- Non-Goals (Out of Scope)
- Design Considerations
- Technical Considerations
- Success Metrics
- Open Questions

### User Story Format

```markdown
### US-001: [Title]
**Description:** As a [user], I want [feature] so that [benefit].

**Acceptance Criteria:**
- [ ] Specific, verifiable criterion
- [ ] Another criterion
- [ ] Typecheck passes
```

Stories are ordered by dependency: schema/database changes first, then backend, then UI.

If the issue is ambiguous, the skill asks clarifying questions before generating.

## Requirements

- Output from `analyze-issue` (or equivalent issue analysis)
