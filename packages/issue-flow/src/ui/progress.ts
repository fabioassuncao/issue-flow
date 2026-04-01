import chalk from 'chalk';
import type { UserStory } from '../types.js';
import { getIcons } from './logger.js';

/**
 * Check if color output is enabled.
 */
function useColor(): boolean {
  if (process.env.NO_COLOR === '1') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

/**
 * Check if unicode output is enabled.
 */
function useUnicode(): boolean {
  if (process.env.NO_COLOR === '1') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

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
