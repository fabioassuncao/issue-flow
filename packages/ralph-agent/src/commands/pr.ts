import { join } from 'node:path';
import { execa } from 'execa';
import { runHeadless } from '../core/headless.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printSuccess, printError, printInfo } from '../ui/logger.js';

/**
 * Extract a PR URL from headless output.
 */
function parsePrUrl(output: string): string | null {
  const match = output.match(/(https:\/\/github\.com\/[^\s]+\/pull\/\d+)/);
  return match?.[1] ?? null;
}

export async function runPr(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);

  printInfo(`Creating PR for issue #${issueNumber}...`);

  // Get current branch
  let branchName: string;
  try {
    const proc = await execa('git', ['branch', '--show-current'], { reject: false });
    branchName = proc.stdout?.toString().trim() ?? '';
    if (!branchName) {
      printError('Could not determine current branch');
      return 1;
    }
  } catch {
    printError('Failed to get current branch');
    return 1;
  }

  const prompt = `You are creating a pull request for issue #${issueNumber} on branch ${branchName}.

Steps:
1. Fetch the issue data: gh issue view ${issueNumber} --json title,body
2. Read the task plan from ${join(issueDir, 'tasks.json')} if it exists
3. Review the git log for this branch: git log main..HEAD --oneline
4. Review the diff: git diff main...HEAD --stat
5. Create a well-structured PR using gh pr create

The PR should:
- Have a clear, concise title (under 70 characters)
- Reference the issue: "Closes #${issueNumber}"
- Include a summary of changes
- Include a test plan

Use this command format:
gh pr create --title "..." --body "..." --base main

IMPORTANT: Output the PR URL after creation so it can be parsed.`;

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 120_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
  });

  if (!result.success) {
    printError(`PR creation failed: ${result.error}`);
    return 1;
  }

  const prUrl = parsePrUrl(result.result);

  // Update pipeline state
  const tasksPath = join(issueDir, 'tasks.json');
  try {
    const plan = await loadTaskPlan(tasksPath);
    plan.pipeline.prCreated = true;
    await saveTaskPlan(tasksPath, plan);
  } catch {
    // tasks.json may not exist
  }

  if (prUrl) {
    printSuccess(`PR created: ${prUrl}`);
  } else {
    printSuccess('PR creation completed');
  }
  return 0;
}
