import { execa, type Options as ExecaOptions } from 'execa';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command with arguments and capture its output.
 * Uses execa which calls execFile internally (no shell injection risk).
 * Does not throw on non-zero exit codes.
 */
export async function run(
  command: string,
  args: string[] = [],
  options?: ExecaOptions,
): Promise<ExecResult> {
  const result = await execa(command, args, {
    reject: false,
    ...options,
  });

  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    exitCode: result.exitCode ?? 1,
  };
}
