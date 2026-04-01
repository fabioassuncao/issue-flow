You are converting a PRD into a structured JSON task plan for issue #__ISSUE_NUMBER__.

Here is the PRD:

__PRD_CONTENT__

Create a tasks.json file at __TASKS_PATH__ with this exact structure:

{
  "project": "<repo-name>",
  "issueNumber": __ISSUE_NUMBER__,
  "issueUrl": "<github-issue-url>",
  "branchName": "issue/__ISSUE_NUMBER__-<slug>",
  "description": "<brief description>",
  "issueStatus": "pending",
  "completedAt": null,
  "lastAttemptAt": null,
  "lastError": null,
  "correctionCycle": 0,
  "maxCorrectionCycles": 3,
  "pipeline": {
    "analyzeCompleted": true,
    "prdCompleted": true,
    "jsonCompleted": true,
    "executionCompleted": false,
    "reviewCompleted": false,
    "prCreated": false
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "...",
      "description": "As a ..., I want ... so that ...",
      "acceptanceCriteria": ["..."],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}

Rules:
- Each user story from the PRD becomes one entry in userStories
- Priority should order stories by dependency (build foundations first)
- acceptanceCriteria must include "Typecheck passes" for code changes
- Get the repo name and issue URL from: gh issue view __ISSUE_NUMBER__ --json url
- The branchName should use a short kebab-case slug derived from the issue title

IMPORTANT: You MUST write the tasks.json to the file path above. Do not just output it.
