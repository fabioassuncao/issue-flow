import { execa } from 'execa';
import type { ClaudeResult } from '../types.js';

/**
 * Execute Claude CLI with a prompt piped to stdin.
 *
 * Runs: echo $PROMPT | claude --dangerously-skip-permissions --print
 *
 * Captures combined stdout+stderr output. Does not throw on non-zero exit codes.
 * Output is also forwarded to the process stderr (matching Bash behavior).
 */
export async function executeClaude(prompt: string): Promise<ClaudeResult> {
  const result = await execa('claude', ['--dangerously-skip-permissions', '--print'], {
    input: prompt,
    reject: false,
    timeout: 0, // No timeout — let the engine handle iteration limits
    stripFinalNewline: false,
  });

  // Combine stdout and stderr to match Bash's 2>&1 behavior
  const stdout = result.stdout?.toString() ?? '';
  const stderr = result.stderr?.toString() ?? '';
  const output = stdout + (stderr ? `\n${stderr}` : '');

  // Forward output to process stderr (matching Bash: printf '%s\n' "$OUTPUT" >&2)
  if (output.trim()) {
    process.stderr.write(`${output}\n`);
  }

  return {
    exitCode: result.exitCode ?? 1,
    output,
  };
}
