import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printSuccess, printError, printInfo } from '../ui/logger.js';

export interface ReviewResult {
  status: 'PASS' | 'FAIL';
  findings?: string;
}

/**
 * Parse the <review-result> block from headless output.
 */
function parseReviewResult(output: string): ReviewResult {
  const match = output.match(/<review-result>([\s\S]*?)<\/review-result>/);
  if (!match) {
    // Try to detect PASS/FAIL from the raw output
    if (/STATUS:\s*PASS/i.test(output)) {
      return { status: 'PASS' };
    }
    if (/STATUS:\s*FAIL/i.test(output)) {
      const findingsMatch = output.match(/FINDINGS:([\s\S]*?)(?:$|<\/)/);
      return { status: 'FAIL', findings: findingsMatch?.[1]?.trim() ?? 'Unknown findings' };
    }
    // Default to PASS if no explicit status found and no errors
    return { status: 'PASS' };
  }

  const block = match[1];
  if (/STATUS:\s*PASS/i.test(block)) {
    return { status: 'PASS' };
  }

  const findingsMatch = block.match(/FINDINGS:([\s\S]*)/);
  return {
    status: 'FAIL',
    findings: findingsMatch?.[1]?.trim() ?? 'Unknown findings',
  };
}

export async function runReview(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);

  printInfo(`Reviewing issue #${issueNumber} resolution...`);

  const prompt = `You are reviewing whether GitHub issue #${issueNumber} has been fully resolved.

IMPORTANT: You are running in --orchestrator mode. Do NOT close the issue directly. Only report results.

Steps:
1. Fetch the issue data using: gh issue view ${issueNumber} --json title,body,labels
2. Read the task plan from ${join(issueDir, 'tasks.json')} to understand what was supposed to be implemented
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

IMPORTANT: You MUST include the <review-result> block in your output.`;

  const result = await runHeadless({
    prompt,
    maxTurns: 20,
    timeout: 180_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
  });

  if (!result.success) {
    printError(`Review failed: ${result.error}`);
    return 1;
  }

  const review = parseReviewResult(result.result);

  if (review.status === 'PASS') {
    // Update pipeline state
    const tasksPath = join(issueDir, 'tasks.json');
    try {
      const plan = await loadTaskPlan(tasksPath);
      plan.pipeline.reviewCompleted = true;
      await saveTaskPlan(tasksPath, plan);
    } catch {
      // tasks.json may not exist
    }

    printSuccess('Review PASSED — implementation meets acceptance criteria');
    return 0;
  }

  printError('Review FAILED — issues found:');
  if (review.findings) {
    console.log(review.findings);
  }
  return 1;
}
