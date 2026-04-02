import { join } from 'node:path';
import { execa } from 'execa';
import { PIPELINE_PHASES, PipelineManager, type PipelinePhase } from '../core/pipeline.js';
import { isoNow, loadTaskPlan, saveTaskPlan } from '../core/state-manager.js';
import { isVerbose } from '../core/verbose.js';
import { formatDuration, printError, printInfo, printSuccess, printWarning } from '../ui/logger.js';
import { runPipelineWithRenderer } from '../ui/pipeline-renderer.js';
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

  // Build phase runner functions that throw on failure
  const makeRunner = (fn: () => Promise<number>, phase: string) => async () => {
    const code = await fn();
    if (code !== 0) {
      throw new Error(`Phase ${phase} failed with exit code ${code}`);
    }
  };

  const runners: Record<string, () => Promise<void>> = {
    analyze: makeRunner(() => runAnalyze(issueNumber), 'analyze'),
    prd: makeRunner(() => runPrd(issueNumber), 'prd'),
    plan: makeRunner(() => runPlan(issueNumber), 'plan'),
    execute: makeRunner(() => runExecute(undefined, { issue: issueNumber }), 'execute'),
    review: async () => {
      // Read maxCorrectionCycles
      let maxCycles = 3;
      try {
        const plan = await loadTaskPlan(tasksPath);
        maxCycles = plan.maxCorrectionCycles;
      } catch {
        /* use default */
      }

      let code = await runReview(issueNumber);

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
          throw new Error('Correction execution failed');
        }

        // Re-review
        code = await runReview(issueNumber);
      }

      if (code !== 0) {
        throw new Error(`Review failed after ${maxCycles} correction cycles`);
      }
    },
    pr: makeRunner(() => runPr(issueNumber), 'pr'),
  };

  // Run pipeline with listr2 renderer — startup header printed above, summary below
  const result = await runPipelineWithRenderer({
    phases: phaseOrder,
    startIndex: startIdx,
    verbose: isVerbose(),
    runners,
    tasksPath,
  });

  if (!result.success) {
    printError(`Phase ${result.failedPhase} failed`);
    return 1;
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

  const totalDuration = formatDuration(result.overallElapsedSeconds);

  console.log('');
  printSuccess(`Pipeline complete for issue #${issueNumber}!`);
  console.log(`  Branch:   ${branchName}`);
  console.log(`  Stories:  ${storyCount}`);
  console.log(`  Duration: ${totalDuration}`);
  console.log(`  PR:       ${prUrl}`);

  return 0;
}
