import chalk from 'chalk';
import ora, { type Ora } from 'ora';

/**
 * Detect if unicode output is supported.
 */
export function useUnicode(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

/**
 * Detect if color output is supported.
 */
export function useColor(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

export interface Icons {
  success: string;
  fail: string;
  pending: string;
  retry: string;
  warn: string;
  start: string;
  end: string;
  notReached: string;
  tool: string;
  connector: string;
}

export function getIcons(): Icons {
  if (useUnicode()) {
    return {
      success: '\u2713',
      fail: '\u2717',
      pending: '\u23F3',
      retry: '\u21BB',
      warn: '\u26A0',
      start: '\u25B6',
      end: '\u25A0',
      notReached: '\u25CB',
      tool: '\u25B8',
      connector: '\u2502',
    };
  }
  return {
    success: '[OK]',
    fail: '[FAIL]',
    pending: '[...]',
    retry: '[RETRY]',
    warn: '[WARN]',
    start: '[START]',
    end: '[END]',
    notReached: '[ ]',
    tool: '>',
    connector: '|',
  };
}

/**
 * Get the terminal width.
 */
export function getTermWidth(): number {
  return process.stdout.columns ?? 80;
}

export function printSuccess(message: string): void {
  const icons = getIcons();
  if (useColor()) {
    console.log(chalk.green(`${icons.success} ${message}`));
  } else {
    console.log(`${icons.success} ${message}`);
  }
}

export function printError(message: string): void {
  const icons = getIcons();
  if (useColor()) {
    console.log(chalk.red(`${icons.fail} ${message}`));
  } else {
    console.log(`${icons.fail} ${message}`);
  }
}

export function printWarning(message: string): void {
  const icons = getIcons();
  if (useColor()) {
    console.log(chalk.yellow(`${icons.warn} ${message}`));
  } else {
    console.log(`${icons.warn} ${message}`);
  }
}

export function printRetry(message: string): void {
  const icons = getIcons();
  if (useColor()) {
    console.log(chalk.yellow(`${icons.retry} ${message}`));
  } else {
    console.log(`${icons.retry} ${message}`);
  }
}

export function printInfo(message: string): void {
  const icons = getIcons();
  if (useColor()) {
    console.log(chalk.blue(`${icons.start} ${message}`));
  } else {
    console.log(`${icons.start} ${message}`);
  }
}

/**
 * Create an ora spinner with consistent styling.
 */
export function createSpinner(message: string): Ora {
  return ora({
    text: message,
    color: 'blue',
    spinner: 'dots',
  });
}

/**
 * Format a duration in seconds to a human-readable string.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Timer that calls a callback every second with the formatted elapsed time.
 */
export class ElapsedTimer {
  private startTime: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cleanup = () => this.stop();

  constructor(private onTick: (elapsed: string) => void) {
    this.startTime = Date.now();
  }

  start(): this {
    this.startTime = Date.now();
    this.intervalId = setInterval(() => {
      const seconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.onTick(formatDuration(seconds));
    }, 1_000);
    // Prevent the timer from keeping the process alive
    if (this.intervalId && typeof this.intervalId === 'object' && 'unref' in this.intervalId) {
      this.intervalId.unref();
    }
    process.on('exit', this.cleanup);
    return this;
  }

  getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  stop(): number {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    process.removeListener('exit', this.cleanup);
    return this.getElapsedSeconds();
  }
}
