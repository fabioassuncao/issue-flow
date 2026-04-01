import { execa } from 'execa';

export interface HeadlessOptions {
  prompt: string;
  maxTurns?: number;
  timeout?: number;
  outputFormat?: 'json' | 'text' | 'stream-json';
  allowedTools?: string[];
}

export interface HeadlessCost {
  inputTokens?: number;
  outputTokens?: number;
}

export interface HeadlessResult {
  success: boolean;
  result: string;
  cost: HeadlessCost | null;
  error: string | null;
}

/**
 * Invoke Claude Code in headless mode via `claude -p`.
 *
 * Each invocation is an isolated session — no context is shared between calls.
 * Output is parsed as JSON when outputFormat is 'json' (default).
 */
export async function runHeadless(options: HeadlessOptions): Promise<HeadlessResult> {
  const { prompt, maxTurns = 10, timeout = 300_000, outputFormat = 'json', allowedTools } = options;

  const args: string[] = [
    '-p',
    prompt,
    '--output-format',
    outputFormat,
    '--max-turns',
    String(maxTurns),
  ];

  if (allowedTools && allowedTools.length > 0) {
    for (const tool of allowedTools) {
      args.push('--allowedTools', tool);
    }
  }

  try {
    const proc = await execa('claude', args, {
      reject: false,
      timeout,
      stripFinalNewline: false,
    });

    const stdout = proc.stdout?.toString() ?? '';
    const stderr = proc.stderr?.toString() ?? '';

    if (proc.exitCode !== 0) {
      return {
        success: false,
        result: '',
        cost: null,
        error: stderr || stdout || `claude exited with code ${proc.exitCode}`,
      };
    }

    if (outputFormat === 'json') {
      try {
        const parsed = JSON.parse(stdout);
        return {
          success: true,
          result: parsed.result ?? stdout,
          cost:
            parsed.cost_usd != null
              ? { inputTokens: parsed.num_input_tokens, outputTokens: parsed.num_output_tokens }
              : null,
          error: null,
        };
      } catch {
        // JSON parse failed — return raw output
        return {
          success: true,
          result: stdout,
          cost: null,
          error: null,
        };
      }
    }

    return {
      success: true,
      result: stdout,
      cost: null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('timed out') || message.includes('ETIMEDOUT')) {
      return {
        success: false,
        result: '',
        cost: null,
        error: `Headless invocation timed out after ${timeout}ms`,
      };
    }

    return {
      success: false,
      result: '',
      cost: null,
      error: message,
    };
  }
}
