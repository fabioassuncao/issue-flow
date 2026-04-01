import chalk from 'chalk';
import type { UserStory } from '../types.js';
import { formatDuration, getIcons, useColor, useUnicode } from './logger.js';

/**
 * Print a visual progress bar showing passed/total stories.
 */
export function printProgressBar(passed: number, total: number): string {
  const barWidth = 20;
  let pct = 0;
  let filled = 0;

  if (total > 0) {
    pct = Math.floor((passed * 100) / total);
    filled = Math.floor((passed * barWidth) / total);
  }

  const empty = barWidth - filled;
  const fillChar = useUnicode() ? '\u2588' : '#';
  const emptyChar = useUnicode() ? '\u2591' : '-';

  const bar = fillChar.repeat(filled) + emptyChar.repeat(empty);
  const text = `${passed}/${total} (${pct}%)`;

  if (useColor()) {
    return `${chalk.green(bar)} ${text}`;
  }
  return `${bar} ${text}`;
}

/**
 * Print the iteration header showing story statuses and progress bar.
 */
export function printIterationHeader(
  iteration: number,
  maxIter: number | undefined,
  stories: UserStory[],
): void {
  const icons = getIcons();
  const colored = useColor();

  const iterLabel = maxIter ? `Iteration ${iteration} of ${maxIter}` : `Iteration ${iteration}`;

  const total = stories.length;
  const passed = stories.filter((s) => s.passes).length;

  console.log('');
  if (colored) {
    console.log(chalk.blue(`\u2501\u2501\u2501 ${icons.start} ${iterLabel} \u2501\u2501\u2501`));
  } else {
    console.log(`--- ${icons.start} ${iterLabel} ---`);
  }
  console.log('');

  // Display each story status
  let foundFirstPending = false;
  for (const story of stories) {
    let icon: string;
    let colorFn: (s: string) => string;

    if (story.passes) {
      icon = icons.success;
      colorFn = colored ? chalk.green : (s: string) => s;
    } else if (!foundFirstPending) {
      // First non-passing story = current in-progress
      icon = icons.pending;
      colorFn = colored ? chalk.yellow : (s: string) => s;
      foundFirstPending = true;
    } else {
      // Not yet reached
      icon = icons.notReached;
      colorFn = colored ? chalk.gray : (s: string) => s;
    }

    console.log(colorFn(`  ${icon} ${story.id}: ${story.title}`));
  }

  console.log('');
  console.log(`  ${printProgressBar(passed, total)}`);
}

/* ── Pipeline progress tracker ────────────────────────────────────────── */

export interface PhaseInfo {
  name: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  durationSeconds: number | null;
}

const PHASE_LABELS: Record<string, string> = {
  analyze: 'Analyze',
  prd: 'PRD',
  plan: 'Plan',
  execute: 'Execute',
  review: 'Review',
  pr: 'PR',
};

/**
 * Tracks and renders pipeline phase progress with live elapsed time.
 */
export class PipelineTracker {
  private phases: PhaseInfo[];
  private overallStartTime: number;
  private currentPhaseStart: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastLineCount = 0;
  private isTTY: boolean;

  constructor(phaseNames: string[], startIndex: number) {
    this.overallStartTime = Date.now();
    this.isTTY = !!process.stderr.isTTY;

    this.phases = phaseNames.map((name, i) => ({
      name,
      label: PHASE_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1),
      status: i < startIndex ? 'skipped' : 'pending',
      durationSeconds: null,
    }));
  }

  startPhase(name: string): void {
    const phase = this.phases.find((p) => p.name === name);
    if (phase) {
      phase.status = 'running';
      this.currentPhaseStart = Date.now();
    }
    this.render();
  }

  completePhase(name: string): void {
    const phase = this.phases.find((p) => p.name === name);
    if (phase) {
      phase.status = 'completed';
      phase.durationSeconds = this.currentPhaseStart
        ? Math.floor((Date.now() - this.currentPhaseStart) / 1000)
        : 0;
      this.currentPhaseStart = null;
    }
    this.render();
  }

  failPhase(name: string): void {
    const phase = this.phases.find((p) => p.name === name);
    if (phase) {
      phase.status = 'failed';
      phase.durationSeconds = this.currentPhaseStart
        ? Math.floor((Date.now() - this.currentPhaseStart) / 1000)
        : 0;
      this.currentPhaseStart = null;
    }
    this.stopLiveUpdate();
    this.render();
  }

  getOverallElapsed(): number {
    return Math.floor((Date.now() - this.overallStartTime) / 1000);
  }

  startLiveUpdate(): void {
    if (!this.isTTY) return;
    this.intervalId = setInterval(() => {
      this.render();
    }, 1_000);
    if (this.intervalId && typeof this.intervalId === 'object' && 'unref' in this.intervalId) {
      this.intervalId.unref();
    }
  }

  stopLiveUpdate(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private render(): void {
    const icons = getIcons();
    const colored = useColor();
    const unicode = useUnicode();

    const overallElapsed = formatDuration(this.getOverallElapsed());
    const separator = unicode ? '\u2500'.repeat(48) : '-'.repeat(48);

    const lines: string[] = [];

    // Header
    const title = 'Pipeline Progress';
    const timeLabel = `Total: ${overallElapsed}`;
    const headerPad = Math.max(0, 48 - title.length - timeLabel.length);
    const headerLine = `  ${title}${' '.repeat(headerPad)}${timeLabel}`;
    lines.push(colored ? chalk.blue(headerLine) : headerLine);
    lines.push(colored ? chalk.dim(`  ${separator}`) : `  ${separator}`);

    // Phase lines
    for (const phase of this.phases) {
      lines.push(this.formatPhase(phase, icons, colored));
    }

    lines.push(''); // trailing blank line

    // Clear previous output if TTY
    if (this.isTTY && this.lastLineCount > 0) {
      process.stderr.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
    }

    this.lastLineCount = lines.length;
    process.stderr.write(`${lines.join('\n')}\n`);
  }

  private formatPhase(phase: PhaseInfo, icons: ReturnType<typeof getIcons>, colored: boolean): string {
    let icon: string;
    let colorFn: (s: string) => string;
    let durationStr = '';

    switch (phase.status) {
      case 'completed':
        icon = icons.success;
        colorFn = colored ? chalk.green : (s: string) => s;
        durationStr = phase.durationSeconds != null ? formatDuration(phase.durationSeconds) : '';
        break;
      case 'running': {
        icon = icons.pending;
        colorFn = colored ? chalk.yellow : (s: string) => s;
        const runningElapsed = this.currentPhaseStart
          ? Math.floor((Date.now() - this.currentPhaseStart) / 1000)
          : 0;
        durationStr = formatDuration(runningElapsed);
        break;
      }
      case 'failed':
        icon = icons.fail;
        colorFn = colored ? chalk.red : (s: string) => s;
        durationStr = phase.durationSeconds != null ? formatDuration(phase.durationSeconds) : '';
        break;
      case 'skipped':
        icon = icons.success;
        colorFn = colored ? chalk.dim : (s: string) => s;
        durationStr = 'skipped';
        break;
      default:
        icon = icons.notReached;
        colorFn = colored ? chalk.gray : (s: string) => s;
        break;
    }

    const label = phase.label;
    if (durationStr) {
      const dotChar = colored ? chalk.dim('.') : '.';
      const maxDots = Math.max(1, 40 - label.length - durationStr.length);
      const dots = dotChar.repeat(maxDots);
      return colorFn(`  ${icon} ${label} ${dots} ${durationStr}`);
    }
    return colorFn(`  ${icon} ${label}`);
  }
}
