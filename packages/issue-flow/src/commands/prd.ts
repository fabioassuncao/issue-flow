import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { applyPlaceholders, loadPrompt } from '../core/prompt-resolver.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printError, printSuccess } from '../ui/logger.js';

export async function runPrd(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);
  const prdPath = join(issueDir, 'prd.md');

  await mkdir(issueDir, { recursive: true });

  // Read analysis if it exists
  let analysisContext = '';
  const analysisPath = join(issueDir, 'analysis.md');
  try {
    const content = await readFile(analysisPath, 'utf-8');
    analysisContext = `\n\nHere is the existing analysis for this issue:\n\n${content}`;
  } catch {
    // No analysis available — that's OK
  }

  const template = await loadPrompt('prd');
  const prompt = applyPlaceholders(template, {
    __ISSUE_NUMBER__: issueNumber,
    __ANALYSIS_CONTEXT__: analysisContext,
    __PRD_PATH__: prdPath,
  });

  const result = await runHeadless({
    prompt,
    maxTurns: 25,
    timeout: 300_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
    statusMessage: `Generating PRD for issue #${issueNumber}...`,
  });

  if (!result.success) {
    printError(`PRD generation failed: ${result.error}`);
    return 1;
  }

  // Verify the file was created
  try {
    const content = await readFile(prdPath, 'utf-8');
    if (content.length < 10) {
      printError('PRD file was created but appears empty');
      return 1;
    }
  } catch {
    printError(`PRD file was not created at ${prdPath}`);
    return 1;
  }

  // Update pipeline state
  const tasksPath = join(issueDir, 'tasks.json');
  try {
    const plan = await loadTaskPlan(tasksPath);
    plan.pipeline.prdCompleted = true;
    await saveTaskPlan(tasksPath, plan);
  } catch {
    // tasks.json may not exist yet
  }

  printSuccess(`PRD saved to ${prdPath}`);
  return 0;
}
