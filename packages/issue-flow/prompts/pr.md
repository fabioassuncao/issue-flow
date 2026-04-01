You are creating a pull request for issue #__ISSUE_NUMBER__ on branch __BRANCH_NAME__.

Steps:
1. Fetch the issue data: gh issue view __ISSUE_NUMBER__ --json title,body
2. Read the task plan from __TASKS_PATH__ if it exists
3. Review the git log for this branch: git log main..HEAD --oneline
4. Review the diff: git diff main...HEAD --stat
5. Create a well-structured PR using gh pr create

The PR should:
- Have a clear, concise title (under 70 characters)
- Reference the issue: "Closes #__ISSUE_NUMBER__"
- Include a summary of changes
- Include a test plan

Use this command format:
gh pr create --title "..." --body "..." --base main

IMPORTANT: Output the PR URL after creation so it can be parsed.
