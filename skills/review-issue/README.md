# review-issue

Reviews whether a GitHub issue has been fully resolved by analyzing the implementation, running tests, and checking for regressions. If everything passes, closes the issue automatically. If not, produces a detailed report of what's missing.

## Usage

**By number:**
```
Review issue #42
```

**Other trigger phrases:**
```
Validate issue #15
Check if issue #7 is done
Is issue #20 resolved?
Close issue #5 if it's done
```

## How It Works

The skill runs a 7-step validation pipeline:

```
Step 1 → Fetch issue context and linked PRs via gh CLI
Step 2 → Detect project stack (language, framework, test runner)
Step 3 → Trace the implementation (PRs, branches, commits, diffs)
Step 4 → Validate each acceptance criterion against actual code changes
Step 5 → Run the project's test suite
Step 6 → Check for regressions in shared code
Step 7 → Produce a structured verdict (APPROVED or REJECTED)
```

## Verdict

The issue is considered **fully resolved** only when ALL of the following are true:

- Every acceptance criterion from the issue is addressed in the code
- Tests pass (no failures related to the changes)
- No regressions detected
- Code follows the project's conventions and patterns

If resolved, the skill closes the issue with a summary comment. If not, it adds a comment detailing what needs attention — without closing.

## Output

A structured report is produced in the same language as the issue:

```
# Code Review — Issue #N: {title}

## Status: [APPROVED / REJECTED]
## Summary
## Requirements Analysis
## Implementation Review
## Tests
## Regressions
## Issues Found (if any)
## Conclusion
```

## Requirements

- **GitHub CLI** (`gh`) authenticated with the repository
- **Git** configured with access to the repository
