let _verbose = false;

export function setVerbose(enabled: boolean): void {
  _verbose = enabled;
}

export function isVerbose(): boolean {
  return _verbose;
}

let _onOutput: ((line: string) => void) | undefined;

/**
 * Set a global output callback for routing verbose output (e.g., through listr2 task.output).
 * Pass undefined to clear and fall back to direct stderr writes.
 */
export function setOutputCallback(callback: ((line: string) => void) | undefined): void {
  _onOutput = callback;
}

export function getOutputCallback(): ((line: string) => void) | undefined {
  return _onOutput;
}

let _onStoryUpdate: ((stories: import('../types.js').UserStory[]) => void) | undefined;

/**
 * Set a global callback for story progress updates during engine execution.
 * Called after each iteration with the latest user stories state.
 * Pass undefined to clear.
 */
export function setStoryUpdateCallback(
  callback: ((stories: import('../types.js').UserStory[]) => void) | undefined,
): void {
  _onStoryUpdate = callback;
}

export function getStoryUpdateCallback():
  | ((stories: import('../types.js').UserStory[]) => void)
  | undefined {
  return _onStoryUpdate;
}

let _globalTimeout: number | undefined;

export function setGlobalTimeout(ms: number): void {
  _globalTimeout = ms;
}

export function getGlobalTimeout(): number | undefined {
  return _globalTimeout;
}
