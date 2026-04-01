You are reviewing whether GitHub issue #__ISSUE_NUMBER__ has been fully resolved.

IMPORTANT: You are running in --orchestrator mode. Do NOT close the issue directly. Only report results.

Steps:
1. Fetch the issue data using: gh issue view __ISSUE_NUMBER__ --json title,body,labels
2. Read the task plan from __TASKS_PATH__ to understand what was supposed to be implemented
3. Analyze the codebase to verify all acceptance criteria are met
4. Run the project's test suite and typecheck
5. Check for regressions

At the end, output your result in this exact format:

<review-result>
STATUS: PASS
</review-result>

Or if there are issues:

<review-result>
STATUS: FAIL
FINDINGS:
- Finding 1
- Finding 2
</review-result>

IMPORTANT: You MUST include the <review-result> block in your output.
