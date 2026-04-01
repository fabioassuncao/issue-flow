import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printError, printInfo, printSuccess } from '../ui/logger.js';

export async function runAnalyze(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);

  printInfo(`Analyzing issue #${issueNumber}...`);

  await mkdir(issueDir, { recursive: true });

  const prompt = `You are analyzing GitHub issue #${issueNumber} for this repository.

Steps:
1. Fetch the issue data using: gh issue view ${issueNumber} --json title,body,labels,comments
2. Analyze the codebase to understand the affected areas, tech stack, and architecture
3. Identify the scope, complexity, and key files/modules involved
4. Produce a structured analysis

Save your analysis to ${join(issueDir, 'analysis.md')} with this structure:

# Issue Analysis: #${issueNumber}

## Summary
[Brief description of the issue]

## Affected Areas
[List files, modules, or systems affected]

## Technical Context
[Relevant architecture, patterns, dependencies]

## Complexity Assessment
[Low/Medium/High with justification]

## Implementation Notes
[Key considerations, risks, dependencies]

IMPORTANT: You MUST write the analysis to the file path above. Do not just output it.`;

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 120_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
  });

  if (!result.success) {
    printError(`Analysis failed: ${result.error}`);
    return 1;
  }

  // Verify the file was created
  const analysisPath = join(issueDir, 'analysis.md');
  try {
    const content = await readFile(analysisPath, 'utf-8');
    if (content.length < 10) {
      printError('Analysis file was created but appears empty');
      return 1;
    }
  } catch {
    // File wasn't created by headless — save the result as analysis
    printInfo('Headless did not create analysis file; saving output directly');
    await writeFile(analysisPath, result.result, 'utf-8');
  }

  // Update pipeline state
  const tasksPath = join(issueDir, 'tasks.json');
  try {
    const plan = await loadTaskPlan(tasksPath);
    plan.pipeline.analyzeCompleted = true;
    await saveTaskPlan(tasksPath, plan);
  } catch {
    // tasks.json may not exist yet — that's OK for standalone analyze
  }

  printSuccess(`Analysis saved to ${analysisPath}`);
  return 0;
}
