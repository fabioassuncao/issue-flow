import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printSuccess, printError, printInfo } from '../ui/logger.js';

export async function runPrd(issue: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);

  printInfo(`Generating PRD for issue #${issueNumber}...`);

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

  const prdPath = join(issueDir, 'prd.md');
  const prompt = `You are generating a Product Requirements Document (PRD) for GitHub issue #${issueNumber} in this repository.${analysisContext}

Steps:
1. If no analysis was provided above, fetch the issue data using: gh issue view ${issueNumber} --json title,body,labels,comments
2. Analyze the codebase to understand the context
3. Generate a structured PRD

Save the PRD to ${prdPath} with this structure:

# PRD: [Issue Title]

## Context
[Why this change is needed]

## Goals
[What success looks like]

## User Stories
[US-001, US-002, etc. with acceptance criteria]

## Technical Approach
[High-level implementation strategy]

## Out of Scope
[What is explicitly NOT included]

## Dependencies
[External dependencies or prerequisites]

IMPORTANT: You MUST write the PRD to the file path above. Do not just output it.`;

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 120_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
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
