import { join } from 'node:path';
import { execa } from 'execa';
import { PIPELINE_PHASES, PipelineManager, type PipelinePhase } from '../core/pipeline.js';
import { isoNow, loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { printError, printInfo, printSuccess, printWarning } from '../ui/logger.js';
import { runAnalyze } from './analyze.js';
import { runExecute } from './execute.js';
import { runInit } from './init.js';
import { runPlan } from './plan.js';
import { runPr } from './pr.js';
import { runPrd } from './prd.js';
import { runReview } from './review.js';

export async function runPipeline(issue: string, mode: string, from?: string): Promise<number> {
  const issueNumber = issue.replace(/^#/, '');
  const issueDir = join('issues', issueNumber);
  const tasksPath = join(issueDir, 'tasks.json');

  printInfo(`Starting pipeline for issue #${issueNumber} (mode: ${mode})`);

  // Phase 1: Init check
  printInfo('Running prerequisite checks...');
  const initCode = await runInit();
  if (initCode !== 0) {
    printError('Prerequisites not met. Fix the issues above and try again.');
    return 1;
  }

  // Determine starting phase
  let startPhase: PipelinePhase = 'analyze';
  if (from) {
    if (!PIPELINE_PHASES.includes(from as PipelinePhase)) {
      printError(`Invalid phase: ${from}. Valid phases: ${PIPELINE_PHASES.join(', ')}`);
      return 1;
    }
    startPhase = from as PipelinePhase;
  } else {
    // Try to auto-resume from pipeline state
    try {
      const plan = await loadTaskPlan(tasksPath);
      const mgr = new PipelineManager(plan, tasksPath);
      const nextPhase = mgr.getNextPhase();
      if (nextPhase && nextPhase !== 'init') {
        startPhase = nextPhase;
        printInfo(`Resuming from phase: ${startPhase}`);
      }
    } catch {
      // No tasks.json yet — start from beginning
    }
  }

  // Validate resume prerequisites if starting from a later phase
  if (from) {
    try {
      const plan = await loadTaskPlan(tasksPath);
      const mgr = new PipelineManager(plan, tasksPath);
      if (!mgr.canResume(startPhase)) {
        printError(`Cannot resume from ${startPhase}: prerequisite phases not complete`);
        return 1;
      }
    } catch {
      if (startPhase !== 'analyze') {
        printError(`Cannot resume from ${startPhase}: no pipeline state found`);
        return 1;
      }
    }
  }

  const phaseOrder: PipelinePhase[] = ['analyze', 'prd', 'plan', 'execute', 'review', 'pr'];
  const startIdx = phaseOrder.indexOf(startPhase);

  for (let i = startIdx; i < phaseOrder.length; i++) {
    const phase = phaseOrder[i];
    printInfo(`\n--- Phase: ${phase} ---`);

    let code: number;
    switch (phase) {
      case 'analyze':
        code = await runAnalyze(issueNumber);
        break;
      case 'prd':
        code = await runPrd(issueNumber);
        break;
      case 'plan':
        code = await runPlan(issueNumber);
        break;
      case 'execute':
        code = await runExecute(undefined, { issue: issueNumber });
        break;
      case 'review': {
        // Read maxCorrectionCycles
        let maxCycles = 3;
        try {
          const plan = await loadTaskPlan(tasksPath);
          maxCycles = plan.maxCorrectionCycles;
        } catch {
          /* use default */
        }

        code = await runReview(issueNumber);

        // Auto-correction loop on failure
        let cycle = 0;
        while (code !== 0 && cycle < maxCycles) {
          cycle++;
          printWarning(`Review failed. Starting correction cycle ${cycle}/${maxCycles}...`);

          // Update correction cycle in tasks.json
          try {
            const plan = await loadTaskPlan(tasksPath);
            plan.correctionCycle = cycle;
            await saveTaskPlan(tasksPath, plan);
          } catch {
            /* non-critical */
          }

          // Re-execute
          const execCode = await runExecute(undefined, { issue: issueNumber });
          if (execCode !== 0) {
            printError('Correction execution failed');
            return 1;
          }

          // Re-review
          code = await runReview(issueNumber);
        }

        if (code !== 0) {
          printError(`Review failed after ${maxCycles} correction cycles`);
          return 1;
        }
        break;
      }
      case 'pr':
        code = await runPr(issueNumber);
        break;
      default:
        code = 1;
    }

    if (code !== 0) {
      printError(`Phase ${phase} failed with exit code ${code}`);
      return 1;
    }
  }

  // Close the issue
  printInfo('Closing issue...');
  try {
    await execa('gh', ['issue', 'close', issueNumber], { reject: false });
  } catch {
    printWarning('Failed to close issue automatically');
  }

  // Get PR URL for summary
  let prUrl = 'unknown';
  try {
    const proc = await execa('gh', ['pr', 'list', '--head', '', '--json', 'url', '--limit', '1'], {
      reject: false,
    });
    const parsed = JSON.parse(proc.stdout?.toString() ?? '[]');
    if (parsed[0]?.url) {
      prUrl = parsed[0].url;
    }
  } catch {
    /* non-critical */
  }

  // Get branch and story count
  let branchName = 'unknown';
  try {
    const proc = await execa('git', ['branch', '--show-current'], { reject: false });
    branchName = proc.stdout?.toString().trim() ?? 'unknown';
  } catch {
    /* non-critical */
  }

  let storyCount = 0;
  try {
    const plan = await loadTaskPlan(tasksPath);
    storyCount = plan.userStories.length;

    // Mark as completed
    plan.issueStatus = 'completed';
    plan.completedAt = isoNow();
    plan.lastAttemptAt = isoNow();
    await saveTaskPlan(tasksPath, plan);
  } catch {
    /* non-critical */
  }

  console.log('');
  printSuccess(`Pipeline complete for issue #${issueNumber}!`);
  console.log(`  Branch: ${branchName}`);
  console.log(`  Stories: ${storyCount}`);
  console.log(`  PR: ${prUrl}`);

  return 0;
}
