#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { createConfig, resolvePaths, validateDependencies } from './config.js';
import { runEngine } from './core/engine.js';
import { printError } from './ui/logger.js';

/**
 * Parse a numeric string, throwing InvalidArgumentError if not a valid number.
 */
function parseInteger(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Must be a non-negative integer.');
  }
  return parsed;
}

const program = new Command();

program
  .name('issue-flow')
  .description(
    'Unified CLI for orchestrating the full issue-flow pipeline via Claude Code Headless.',
  )
  .version('2.0.0');

// ── init ────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Verify that all prerequisites (claude, gh, git) are met')
  .action(async () => {
    const { runInit } = await import('./commands/init.js');
    const code = await runInit();
    process.exit(code);
  });

// ── generate ────────────────────────────────────────────────────────────────
program
  .command('generate')
  .description('Create a GitHub issue via Claude Code Headless')
  .requiredOption('--prompt <text>', 'Issue description text')
  .action(async (options: { prompt: string }) => {
    const { runGenerate } = await import('./commands/generate.js');
    const code = await runGenerate(options.prompt);
    process.exit(code);
  });

// ── run ─────────────────────────────────────────────────────────────────────
program
  .command('run')
  .description('Execute the full pipeline: analyze → prd → plan → execute → review → pr')
  .argument('<issue>', 'Issue number')
  .option('--mode <mode>', 'Execution mode: auto | semi_auto | manual', 'auto')
  .option('--from <phase>', 'Resume from a specific phase')
  .action(async (issue: string, options: { mode: string; from?: string }) => {
    const { runPipeline } = await import('./commands/run.js');
    const code = await runPipeline(issue, options.mode, options.from);
    process.exit(code);
  });

// ── analyze ─────────────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('Analyze a GitHub issue via Claude Code Headless')
  .argument('<issue>', 'Issue number')
  .action(async (issue: string) => {
    const { runAnalyze } = await import('./commands/analyze.js');
    const code = await runAnalyze(issue);
    process.exit(code);
  });

// ── prd ─────────────────────────────────────────────────────────────────────
program
  .command('prd')
  .description('Generate a PRD from an analyzed issue via Claude Code Headless')
  .argument('<issue>', 'Issue number')
  .action(async (issue: string) => {
    const { runPrd } = await import('./commands/prd.js');
    const code = await runPrd(issue);
    process.exit(code);
  });

// ── plan ────────────────────────────────────────────────────────────────────
program
  .command('plan')
  .description('Convert a PRD to a tasks.json task plan via Claude Code Headless')
  .argument('<issue>', 'Issue number')
  .action(async (issue: string) => {
    const { runPlan } = await import('./commands/plan.js');
    const code = await runPlan(issue);
    process.exit(code);
  });

// ── execute ─────────────────────────────────────────────────────────────────
program
  .command('execute')
  .description('Run the iterative story execution loop (ralph-agent engine)')
  .option('--issue <number>', 'Issue number — reads artifacts from issues/N/')
  .option('--max-iterations <number>', 'Stop after N iterations', parseInteger)
  .option('--retry-limit <number>', 'Retry transient Claude failures up to N consecutive times', parseInteger)
  .option('--retry-forever', 'Retry transient Claude failures indefinitely')
  .argument('[max-iterations]', 'Backward-compatible alias for --max-iterations N', parseInteger)
  .action(async (positionalMaxIter: number | undefined, options: {
    issue?: string;
    maxIterations?: number;
    retryLimit?: number;
    retryForever?: boolean;
  }) => {
    try {
      const errors = await validateDependencies();
      if (errors.length > 0) {
        printError('The following required tools are not installed:');
        for (const err of errors) {
          console.log(err);
        }
        process.exit(1);
      }

      const maxIterations = options.maxIterations ?? positionalMaxIter;

      const config = createConfig({
        issueNumber: options.issue,
        maxIterations,
        retryLimit: options.retryLimit,
        retryForever: options.retryForever,
      });

      const paths = await resolvePaths(config);
      const exitCode = await runEngine(config, paths);
      process.exit(exitCode);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// ── review ──────────────────────────────────────────────────────────────────
program
  .command('review')
  .description('Validate an issue resolution via Claude Code Headless')
  .argument('<issue>', 'Issue number')
  .action(async (issue: string) => {
    const { runReview } = await import('./commands/review.js');
    const code = await runReview(issue);
    process.exit(code);
  });

// ── pr ──────────────────────────────────────────────────────────────────────
program
  .command('pr')
  .description('Create a pull request via Claude Code Headless')
  .argument('<issue>', 'Issue number')
  .action(async (issue: string) => {
    const { runPr } = await import('./commands/pr.js');
    const code = await runPr(issue);
    process.exit(code);
  });

program.parse();
