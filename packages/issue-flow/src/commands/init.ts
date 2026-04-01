import { execa } from 'execa';
import { printError, printInfo, printSuccess } from '../ui/logger.js';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  hint?: string;
}

async function checkClaude(): Promise<CheckResult> {
  try {
    const proc = await execa('claude', ['--version'], { reject: false, timeout: 10_000 });
    if (proc.exitCode === 0) {
      const version = proc.stdout?.toString().trim() ?? 'unknown';
      return { name: 'claude CLI', passed: true, detail: version };
    }
    return {
      name: 'claude CLI',
      passed: false,
      detail: 'claude command failed',
      hint: 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code',
    };
  } catch {
    return {
      name: 'claude CLI',
      passed: false,
      detail: 'claude not found',
      hint: 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code',
    };
  }
}

async function checkGh(): Promise<CheckResult> {
  try {
    const proc = await execa('gh', ['--version'], { reject: false, timeout: 10_000 });
    if (proc.exitCode !== 0) {
      return {
        name: 'gh CLI',
        passed: false,
        detail: 'gh command failed',
        hint: 'Install GitHub CLI: https://cli.github.com/',
      };
    }
    const version = proc.stdout?.toString().split('\n')[0]?.trim() ?? 'unknown';

    // Check auth status
    const auth = await execa('gh', ['auth', 'status'], { reject: false, timeout: 10_000 });
    if (auth.exitCode !== 0) {
      return {
        name: 'gh CLI',
        passed: false,
        detail: `${version} (not authenticated)`,
        hint: 'Run: gh auth login',
      };
    }
    return { name: 'gh CLI', passed: true, detail: `${version} (authenticated)` };
  } catch {
    return {
      name: 'gh CLI',
      passed: false,
      detail: 'gh not found',
      hint: 'Install GitHub CLI: https://cli.github.com/',
    };
  }
}

async function checkGit(): Promise<CheckResult> {
  try {
    const proc = await execa('git', ['--version'], { reject: false, timeout: 10_000 });
    if (proc.exitCode !== 0) {
      return {
        name: 'git',
        passed: false,
        detail: 'git command failed',
        hint: 'Install git: https://git-scm.com/',
      };
    }
    const version = proc.stdout?.toString().trim() ?? 'unknown';

    // Check if current directory is a git repo
    const repo = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
      reject: false,
      timeout: 5_000,
    });
    if (repo.exitCode !== 0) {
      return {
        name: 'git',
        passed: false,
        detail: `${version} (not a git repository)`,
        hint: 'Run this command inside a git repository',
      };
    }
    return { name: 'git', passed: true, detail: `${version} (inside repo)` };
  } catch {
    return {
      name: 'git',
      passed: false,
      detail: 'git not found',
      hint: 'Install git: https://git-scm.com/',
    };
  }
}

export async function runInit(): Promise<number> {
  printInfo('Checking prerequisites...\n');

  const results = await Promise.all([checkClaude(), checkGh(), checkGit()]);

  for (const r of results) {
    if (r.passed) {
      printSuccess(`${r.name}: ${r.detail}`);
    } else {
      printError(`${r.name}: ${r.detail}`);
      if (r.hint) {
        console.log(`    ${r.hint}`);
      }
    }
  }

  const allPassed = results.every((r) => r.passed);
  console.log('');
  if (allPassed) {
    printSuccess('All prerequisites met. Ready to run the pipeline.');
  } else {
    printError('Some prerequisites are missing. Please fix the issues above.');
  }

  return allPassed ? 0 : 1;
}
