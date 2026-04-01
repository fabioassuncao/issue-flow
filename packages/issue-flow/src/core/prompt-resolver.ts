import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the absolute path to the package's prompts/ directory.
 * Works from both source (src/core/) and compiled (dist/) locations
 * by walking up the directory tree until the prompts/ folder is found.
 */
function getPromptsDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'prompts');
    if (existsSync(candidate)) {
      return candidate;
    }
    dir = dirname(dir);
  }

  throw new Error(
    'Could not locate the prompts/ directory. Ensure the package is installed correctly.',
  );
}

/**
 * Load a prompt template by name from the package's prompts/ directory.
 *
 * @param name - Prompt name without extension (e.g., 'execute', 'analyze')
 * @returns The raw template content with placeholders intact
 */
export async function loadPrompt(name: string): Promise<string> {
  const promptsDir = getPromptsDir();
  const filePath = join(promptsDir, `${name}.md`);

  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Prompt template not found: ${filePath}`);
  }
}

/**
 * Replace placeholders in a prompt template with actual values.
 *
 * Placeholders use the format __KEY__ (e.g., __ISSUE_NUMBER__, __PRD_FILE__).
 */
export function applyPlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}
