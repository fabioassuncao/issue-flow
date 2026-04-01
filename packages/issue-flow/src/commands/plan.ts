import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { applyPlaceholders, loadPrompt } from '../core/prompt-resolver.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { taskPlanSchema } from '../schemas.js';
import { printError, printInfo, printSuccess } from '../ui/logger.js';

export async function runPlan(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);

  printInfo(`Converting PRD to task plan for issue #${issueNumber}...`);

  // Read the PRD
  const prdPath = join(issueDir, 'prd.md');
  let prdContent: string;
  try {
    prdContent = await readFile(prdPath, 'utf-8');
  } catch {
    printError(`PRD not found at ${prdPath}. Run 'issue-flow prd ${issueNumber}' first.`);
    return 1;
  }

  const tasksPath = join(issueDir, 'tasks.json');

  const template = await loadPrompt('plan');
  const prompt = applyPlaceholders(template, {
    __ISSUE_NUMBER__: issueNumber,
    __PRD_CONTENT__: prdContent,
    __TASKS_PATH__: tasksPath,
  });

  await mkdir(issueDir, { recursive: true });

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 120_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
  });

  if (!result.success) {
    printError(`Task plan generation failed: ${result.error}`);
    return 1;
  }

  // Validate the created file
  let rawContent: string;
  try {
    rawContent = await readFile(tasksPath, 'utf-8');
  } catch {
    printError(`tasks.json was not created at ${tasksPath}`);
    return 1;
  }

  // Validate JSON structure
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    printError('tasks.json contains invalid JSON');
    return 1;
  }

  // Validate with zod schema
  const validation = taskPlanSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    printError(`tasks.json does not match expected schema:\n${issues}`);
    return 1;
  }

  // Ensure pipeline state reflects completion of this phase
  const plan = await loadTaskPlan(tasksPath);
  plan.pipeline.jsonCompleted = true;
  await saveTaskPlan(tasksPath, plan);

  printSuccess(`Task plan saved to ${tasksPath} (${plan.userStories.length} stories)`);
  return 0;
}
