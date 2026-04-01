import { runHeadless } from '../core/headless.js';
import { applyPlaceholders, loadPrompt } from '../core/prompt-resolver.js';
import { printError, printSuccess } from '../ui/logger.js';

/**
 * Extract an issue URL from headless output.
 */
function parseIssueUrl(output: string): string | null {
  const match = output.match(/(https:\/\/github\.com\/[^\s]+\/issues\/\d+)/);
  return match?.[1] ?? null;
}

export async function runGenerate(promptText: string): Promise<number> {
  const template = await loadPrompt('generate');
  const prompt = applyPlaceholders(template, {
    __USER_PROMPT__: promptText,
  });

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 180_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
    statusMessage: 'Creating GitHub issue...',
  });

  if (!result.success) {
    printError(`Issue creation failed: ${result.error}`);
    return 1;
  }

  const issueUrl = parseIssueUrl(result.result);

  if (issueUrl) {
    printSuccess(`Issue created: ${issueUrl}`);
  } else {
    printSuccess('Issue creation completed');
  }
  return 0;
}
