import chalk from 'chalk';
import type { EngineConfig, TaskPlan } from '../types.js';
import { formatDuration, getIcons, getTermWidth } from './logger.js';

/**
 * Check if color/unicode output is enabled.
 */
function useColor(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

function useUnicode(): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== '') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

/**
 * Truncate or pad a string to fit within a given width.
 */
function fitLine(text: string, width: number): string {
  if (text.length > width) {
    return text.substring(0, width);
  }
  return text.padEnd(width);
}

/**
 * Print a box with border characters around content lines.
 * Lines equal to "---" render as separator rows.
 */
export function printBox(lines: string[]): void {
  const colored = useColor();
  const unicode = useUnicode();
  const termWidth = getTermWidth();

  // Find max content width
  let maxContentWidth = 0;
  for (const line of lines) {
    if (line !== '---' && line.length > maxContentWidth) {
      maxContentWidth = line.length;
    }
  }

  // Cap to terminal width (border + padding = 4 chars)
  const available = termWidth - 4;
  if (maxContentWidth > available) {
    maxContentWidth = available;
  }
  if (maxContentWidth < 20) {
    maxContentWidth = 20;
  }

  // Box drawing characters
  const tl = unicode ? '\u256D' : '+';
  const tr = unicode ? '\u256E' : '+';
  const bl = unicode ? '\u2570' : '+';
  const br = unicode ? '\u256F' : '+';
  const h = unicode ? '\u2500' : '-';
  const v = unicode ? '\u2502' : '|';
  const sepL = unicode ? '\u251C' : '+';
  const sepR = unicode ? '\u2524' : '+';

  const hrule = h.repeat(maxContentWidth + 2);

  const blue = colored ? chalk.blue : (s: string) => s;
  const _reset = (s: string) => s;

  // Top border
  console.log(blue(`${tl}${hrule}${tr}`));

  // Content lines
  for (const line of lines) {
    if (line === '---') {
      console.log(blue(`${sepL}${hrule}${sepR}`));
    } else {
      const fitted = fitLine(line, maxContentWidth);
      console.log(`${blue(v)} ${fitted} ${blue(v)}`);
    }
  }

  // Bottom border
  console.log(blue(`${bl}${hrule}${br}`));
}

/**
 * Print the startup header box showing engine configuration.
 */
export function printStartupHeader(config: EngineConfig, plan: TaskPlan): void {
  const icons = getIcons();

  const storiesTotal = plan.userStories.length;
  const storiesPassing = plan.userStories.filter((s) => s.passes).length;
  const branchName = plan.branchName ?? 'N/A';

  const issueLabel = config.issueNumber ? `Issue #${config.issueNumber}` : 'Standalone mode';

  const maxIterLabel =
    config.maxIterations !== undefined ? String(config.maxIterations) : 'unlimited';

  const retryLabel = config.retryForever
    ? 'unlimited retries'
    : `${config.retryLimit} consecutive retries`;

  printBox([
    `${icons.start} Issue Flow`,
    '---',
    `Issue:       ${issueLabel}`,
    `Branch:      ${branchName}`,
    `Stories:     ${storiesPassing}/${storiesTotal} passing`,
    `Iterations:  ${maxIterLabel}`,
    `Retries:     ${retryLabel}`,
  ]);
}

// Re-export formatDuration from logger to maintain backwards compatibility
export { formatDuration } from './logger.js';

/**
 * Print the final summary box.
 */
export function printSummaryBox(
  status: 'success' | 'incomplete' | 'failed',
  iterations: number,
  totalRetries: number,
  elapsedSeconds: number,
  plan: TaskPlan,
  extraInfo?: string,
): void {
  const icons = getIcons();

  const storiesTotal = plan.userStories.length;
  const storiesPassing = plan.userStories.filter((s) => s.passes).length;
  const duration = formatDuration(elapsedSeconds);

  let statusIcon: string;
  let statusLabel: string;

  switch (status) {
    case 'success':
      statusIcon = icons.success;
      statusLabel = 'Completed';
      break;
    case 'incomplete':
      statusIcon = icons.warn;
      statusLabel = 'Incomplete';
      break;
    case 'failed':
      statusIcon = icons.fail;
      statusLabel = 'Failed';
      break;
  }

  const boxLines = [
    `${icons.end} Issue Flow Summary`,
    '---',
    `Status:      ${statusIcon} ${statusLabel}`,
    `Stories:     ${storiesPassing}/${storiesTotal} passing`,
    `Iterations:  ${iterations}`,
    `Duration:    ${duration}`,
    `Retries:     ${totalRetries}`,
  ];

  if (extraInfo) {
    boxLines.push('---');
    boxLines.push(extraInfo);
  }

  console.log('');
  printBox(boxLines);
}
