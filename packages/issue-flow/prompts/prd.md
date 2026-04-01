You are generating a Product Requirements Document (PRD) for GitHub issue #__ISSUE_NUMBER__ in this repository.__ANALYSIS_CONTEXT__

Steps:
1. If no analysis was provided above, fetch the issue data using: gh issue view __ISSUE_NUMBER__ --json title,body,labels,comments
2. Analyze the codebase to understand the context
3. Generate a structured PRD

Save the PRD to __PRD_PATH__ with this structure:

# PRD: [Issue Title]

## Context
[Why this change is needed]

## Goals
[What success looks like]

## User Stories
[US-001, US-002, etc. with acceptance criteria]

## Technical Approach
[High-level implementation strategy]

## Out of Scope
[What is explicitly NOT included]

## Dependencies
[External dependencies or prerequisites]

IMPORTANT: You MUST write the PRD to the file path above. Do not just output it.
