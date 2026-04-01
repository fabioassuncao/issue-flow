import { platform } from 'node:os';
import { join } from 'node:path';
import type { EngineConfig, ResolvedPaths } from './types.js';
import { getProjectRoot } from './utils/git.js';
import { run } from './utils/shell.js';

/**
 * Default configuration values — matching the Bash script exactly.
 */
export const DEFAULTS = {
  retryLimit: 10,
  retryForever: false,
  backoffBaseSeconds: 30,
  backoffMaxSeconds: 900,
} as const;

/**
 * Create a EngineConfig with defaults merged with provided options.
 */
export function createConfig(options: Partial<EngineConfig>): EngineConfig {
  return {
    issueNumber: options.issueNumber,
    maxIterations: options.maxIterations,
    retryLimit: options.retryLimit ?? DEFAULTS.retryLimit,
    retryForever: options.retryForever ?? DEFAULTS.retryForever,
    backoffBaseSeconds: options.backoffBaseSeconds ?? DEFAULTS.backoffBaseSeconds,
    backoffMaxSeconds: options.backoffMaxSeconds ?? DEFAULTS.backoffMaxSeconds,
  };
}

/**
 * Resolve file paths based on issue number and project root.
 *
 * With --issue N:
 *   prdFile = {projectRoot}/issues/{N}/tasks.json
 *   progressFile = {projectRoot}/issues/{N}/progress.txt
 *
 * Standalone:
 *   prdFile = {projectRoot}/prd.json
 *   progressFile = {projectRoot}/progress.txt
 */
export async function resolvePaths(
  config: EngineConfig,
  scriptDir?: string,
): Promise<ResolvedPaths> {
  const projectRoot = await getProjectRoot();

  if (config.issueNumber) {
    const issueDir = join(projectRoot, 'issues', config.issueNumber);
    return {
      prdFile: join(issueDir, 'tasks.json'),
      progressFile: join(issueDir, 'progress.txt'),
      archiveDir: join(issueDir, 'archive'),
      lastBranchFile: join(issueDir, '.last-branch'),
      projectRoot,
    };
  }

  // Standalone mode — use scriptDir if available, otherwise projectRoot
  const base = scriptDir ?? projectRoot;
  return {
    prdFile: join(base, 'prd.json'),
    progressFile: join(base, 'progress.txt'),
    archiveDir: join(base, 'archive'),
    lastBranchFile: join(base, '.last-branch'),
    projectRoot,
  };
}

/**
 * Return a platform-appropriate install hint for a given package.
 */
export function getInstallHint(pkg: string): string {
  const os = platform();

  if (os === 'darwin') {
    return `brew install ${pkg}`;
  }

  // Default to a generic hint
  return `install ${pkg} using your system package manager`;
}

/**
 * Validate that required external dependencies are available.
 * Returns an array of error messages (empty if all deps are found).
 */
export async function validateDependencies(): Promise<string[]> {
  const errors: string[] = [];

  // Check git
  const gitResult = await run('git', ['--version']);
  if (gitResult.exitCode !== 0) {
    errors.push(`  - git  (install with: ${getInstallHint('git')})`);
  }

  // Check claude
  const claudeResult = await run('claude', ['--version']);
  if (claudeResult.exitCode !== 0) {
    errors.push('  - claude  (install with: npm install -g @anthropic-ai/claude-code)');
  }

  // Note: jq is NOT required — the TypeScript CLI handles JSON natively

  return errors;
}
