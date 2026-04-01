You are analyzing GitHub issue #__ISSUE_NUMBER__ for this repository.

Steps:
1. Fetch the issue data using: gh issue view __ISSUE_NUMBER__ --json title,body,labels,comments
2. Analyze the codebase to understand the affected areas, tech stack, and architecture
3. Identify the scope, complexity, and key files/modules involved
4. Produce a structured analysis

Save your analysis to __ANALYSIS_PATH__ with this structure:

# Issue Analysis: #__ISSUE_NUMBER__

## Summary
[Brief description of the issue]

## Affected Areas
[List files, modules, or systems affected]

## Technical Context
[Relevant architecture, patterns, dependencies]

## Complexity Assessment
[Low/Medium/High with justification]

## Implementation Notes
[Key considerations, risks, dependencies]

IMPORTANT: You MUST write the analysis to the file path above. Do not just output it.
