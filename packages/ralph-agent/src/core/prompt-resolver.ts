import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REMOTE_URL =
  'https://raw.githubusercontent.com/fabioassuncao/issue-flow/main/scripts/ralph/prompt.md';

export interface PromptResolverOptions {
  /** Directory where the script lives (may contain prompt.md) */
  scriptDir?: string;
  /** Project root directory */
  projectRoot: string;
}

interface ResolvedPrompt {
  content: string;
  source: 'local' | 'remote';
  /** Temporary directory to clean up (only for remote downloads) */
  tmpDir?: string;
}

/**
 * Resolve prompt.md from a local path or by downloading from remote.
 *
 * Resolution order:
 * 1. scriptDir/prompt.md (if scriptDir is provided)
 * 2. projectRoot/scripts/ralph/prompt.md
 * 3. Download from GitHub
 */
export async function resolvePrompt(
  options: PromptResolverOptions,
): Promise<ResolvedPrompt> {
  // Try local paths first
  const localPaths = [
    options.scriptDir ? join(options.scriptDir, 'prompt.md') : null,
    join(options.projectRoot, 'scripts', 'ralph', 'prompt.md'),
  ].filter((p): p is string => p !== null);

  for (const localPath of localPaths) {
    if (existsSync(localPath)) {
      const content = await readFile(localPath, 'utf-8');
      return { content, source: 'local' };
    }
  }

  // Download from remote
  const tmpDir = join(tmpdir(), `ralph-prompt-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, 'prompt.md');

  try {
    const response = await fetch(REMOTE_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to download prompt.md: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new Error('Downloaded prompt.md is empty');
    }

    await writeFile(tmpFile, content, 'utf-8');
    return { content, source: 'remote', tmpDir };
  } catch (error) {
    // Clean up temp dir on failure
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      `prompt.md not found locally and remote download failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Replace placeholders in the prompt template with actual file paths.
 */
export function applyPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/**
 * Clean up temporary files created by the prompt resolver.
 */
export async function cleanupPromptTmp(tmpDir?: string): Promise<void> {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
