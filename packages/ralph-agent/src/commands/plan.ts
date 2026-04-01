import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHeadless } from '../core/headless.js';
import { loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { taskPlanSchema } from '../schemas.js';
import { printSuccess, printError, printInfo } from '../ui/logger.js';

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
  const prompt = `You are converting a PRD into a structured JSON task plan for issue #${issueNumber}.

Here is the PRD:

${prdContent}

Create a tasks.json file at ${tasksPath} with this exact structure:

{
  "project": "<repo-name>",
  "issueNumber": ${issueNumber},
  "issueUrl": "<github-issue-url>",
  "branchName": "issue/${issueNumber}-<slug>",
  "description": "<brief description>",
  "issueStatus": "pending",
  "completedAt": null,
  "lastAttemptAt": null,
  "lastError": null,
  "correctionCycle": 0,
  "maxCorrectionCycles": 3,
  "pipeline": {
    "analyzeCompleted": true,
    "prdCompleted": true,
    "jsonCompleted": true,
    "executionCompleted": false,
    "reviewCompleted": false,
    "prCreated": false
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "...",
      "description": "As a ..., I want ... so that ...",
      "acceptanceCriteria": ["..."],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}

Rules:
- Each user story from the PRD becomes one entry in userStories
- Priority should order stories by dependency (build foundations first)
- acceptanceCriteria must include "Typecheck passes" for code changes
- Get the repo name and issue URL from: gh issue view ${issueNumber} --json url
- The branchName should use a short kebab-case slug derived from the issue title

IMPORTANT: You MUST write the tasks.json to the file path above. Do not just output it.`;

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
