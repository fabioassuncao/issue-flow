import { runHeadless } from '../core/headless.js';
import { printSuccess, printError, printInfo } from '../ui/logger.js';

/**
 * Extract an issue URL from headless output.
 */
function parseIssueUrl(output: string): string | null {
  const match = output.match(/(https:\/\/github\.com\/[^\s]+\/issues\/\d+)/);
  return match?.[1] ?? null;
}

export async function runGenerate(promptText: string): Promise<number> {
  printInfo('Creating GitHub issue...');

  const prompt = `You are creating a GitHub issue for this repository.

The user provided this description:
${promptText}

Steps:
1. Analyze the project's tech stack, architecture, and codebase
2. Check for duplicate issues: gh issue list --state open --search "<keywords>"
3. Create a well-structured GitHub issue using gh issue create

The issue should:
- Have a clear, descriptive title
- Include context about why the change is needed
- Include acceptance criteria
- Add appropriate labels (create them if they don't exist)

Use: gh issue create --title "..." --body "..."

IMPORTANT: Output the issue URL after creation so it can be parsed.`;

  const result = await runHeadless({
    prompt,
    maxTurns: 15,
    timeout: 120_000,
    outputFormat: 'text',
    allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
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
