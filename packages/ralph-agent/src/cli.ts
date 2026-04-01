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
  .name('ralph-agent')
  .description(
    'Autonomous AI agent loop that runs Claude Code iteratively until all task plan stories are complete.',
  )
  .version('1.0.0')
  .option(
    '--issue <number>',
    'Issue number — reads artifacts from issues/N/',
  )
  .option(
    '--max-iterations <number>',
    'Stop after N iterations (default: unlimited)',
    parseInteger,
  )
  .option(
    '--retry-limit <number>',
    'Retry transient Claude failures up to N consecutive times (default: 10)',
    parseInteger,
  )
  .option(
    '--retry-forever',
    'Retry transient Claude failures indefinitely',
  )
  .argument(
    '[max-iterations]',
    'Backward-compatible alias for --max-iterations N',
    parseInteger,
  )
  .action(async (positionalMaxIter: number | undefined, options: {
    issue?: string;
    maxIterations?: number;
    retryLimit?: number;
    retryForever?: boolean;
  }) => {
    try {
      // Validate dependencies
      const errors = await validateDependencies();
      if (errors.length > 0) {
        printError('The following required tools are not installed:');
        for (const err of errors) {
          console.log(err);
        }
        process.exit(1);
      }

      // Merge positional max-iterations with --max-iterations flag
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
      printError(
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program.parse();
