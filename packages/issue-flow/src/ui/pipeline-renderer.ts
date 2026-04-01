import { Listr, PRESET_TIMER, PRESET_TIMESTAMP } from 'listr2';
import type { PipelinePhase } from '../core/pipeline.js';
import { setOutputCallback } from '../core/verbose.js';

/**
 * Result returned after the pipeline renderer finishes.
 */
export interface PipelineResult {
  success: boolean;
  failedPhase?: string;
  overallElapsedSeconds: number;
}

/**
 * Options for runPipelineWithRenderer.
 */
export interface PipelineRendererOptions {
  /** All pipeline phases in order */
  phases: PipelinePhase[];
  /** Index of the first phase to run (phases before this are skipped) */
  startIndex: number;
  /** Whether verbose mode is enabled */
  verbose: boolean;
  /** Map of phase name to its async runner function */
  runners: Record<string, () => Promise<void>>;
}

/**
 * Phase labels for display.
 */
const PHASE_LABELS: Record<string, string> = {
  analyze: 'Analyze',
  prd: 'PRD',
  plan: 'Plan',
  execute: 'Execute',
  review: 'Review',
  pr: 'PR',
};

/**
 * Select the appropriate listr2 renderer based on environment.
 *
 * - TTY + not verbose -> 'default' (animated spinners)
 * - TTY + verbose -> 'verbose' (sequential lines)
 * - Non-TTY / CI -> 'simple' (plain timestamped output)
 */
function selectRenderer(verbose: boolean): 'default' | 'verbose' | 'simple' {
  const isTTY = !!process.stdout.isTTY;
  const isCI = !!process.env.CI;
  const noColor = process.env.NO_COLOR != null && process.env.NO_COLOR !== '';

  if (!isTTY || isCI || noColor) {
    return 'simple';
  }

  return verbose ? 'verbose' : 'default';
}

/**
 * Run the pipeline phases through listr2 for single-writer terminal output.
 *
 * Phases before startIndex are displayed as "skipped".
 * Each running phase shows an animated spinner with elapsed time.
 * Completed phases show a checkmark with final duration.
 */
export async function runPipelineWithRenderer(
  options: PipelineRendererOptions,
): Promise<PipelineResult> {
  const { phases, startIndex, verbose, runners } = options;
  const overallStart = Date.now();
  let currentPhase: string | undefined;
  const renderer = selectRenderer(verbose);
  const isSimple = renderer === 'simple';

  const tasks = new Listr(
    phases.map((phase, index) => {
      const label = PHASE_LABELS[phase] ?? phase.charAt(0).toUpperCase() + phase.slice(1);

      return {
        title: label,
        skip: index < startIndex ? 'skipped' : false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        task: async (_ctx: unknown, task: any) => {
          currentPhase = phase;
          const runner = runners[phase];
          if (!runner) {
            throw new Error(`No runner defined for phase: ${phase}`);
          }
          // Route all output (print functions + verbose streaming) through task.output
          // so listr2 controls rendering and prevents concurrent stdout writes
          setOutputCallback((line: string) => { task.output = line; });
          try {
            await runner();
          } finally {
            setOutputCallback(undefined);
          }
        },
        rendererOptions: {
          timer: PRESET_TIMER,
          outputBar: verbose ? Infinity : false,
          persistentOutput: false,
        },
      };
    }),
    {
      renderer,
      rendererOptions: {
        timer: PRESET_TIMER,
        collapseSkips: false,
        ...(isSimple ? { timestamp: PRESET_TIMESTAMP } : {}),
      },
      exitOnError: true,
    },
  );

  let failedPhase: string | undefined;

  try {
    await tasks.run();
  } catch {
    failedPhase = currentPhase ?? phases[startIndex];
  }

  const overallElapsedSeconds = Math.floor((Date.now() - overallStart) / 1000);

  return {
    success: !failedPhase,
    failedPhase,
    overallElapsedSeconds,
  };
}
