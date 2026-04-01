let _verbose = false;

export function setVerbose(enabled: boolean): void {
  _verbose = enabled;
}

export function isVerbose(): boolean {
  return _verbose;
}

let _globalTimeout: number | undefined;

export function setGlobalTimeout(ms: number): void {
  _globalTimeout = ms;
}

export function getGlobalTimeout(): number | undefined {
  return _globalTimeout;
}
