import { join } from 'node:path';
import { execa } from 'execa';
import { runHeadless } from '../core/headless.js';
import { applyPlaceholders, loadPrompt } from '../core/prompt-resolver.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printError, printSuccess } from '../ui/logger.js';

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
  const tasksPath = join(issueDir, 'tasks.json');

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

  const template = await loadPrompt('pr');
  const prompt = applyPlaceholders(template, {
    __ISSUE_NUMBER__: issueNumber,
    __BRANCH_NAME__: branchName,
    __TASKS_PATH__: tasksPath,
  });

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 180_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
    statusMessage: `Creating PR for issue #${issueNumber}...`,
  });

  if (!result.success) {
    printError(`PR creation failed: ${result.error}`);
    return 1;
  }

  const prUrl = parsePrUrl(result.result);

  // Update pipeline state
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
