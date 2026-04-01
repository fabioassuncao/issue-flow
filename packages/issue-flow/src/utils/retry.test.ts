import { describe, expect, it } from 'vitest';
import { isTransientFailure, retryDelaySeconds } from './retry.js';

describe('isTransientFailure', () => {
  it('should detect exit code 75 as transient', () => {
    expect(isTransientFailure(75, '')).toBe(true);
  });

  it('should detect timeout string as transient', () => {
    expect(isTransientFailure(1, 'Connection timed out after 30s')).toBe(true);
  });

  it('should detect connection reset as transient', () => {
    expect(isTransientFailure(1, 'Error: ECONNRESET')).toBe(true);
  });

  it('should detect rate limit as transient', () => {
    expect(isTransientFailure(1, 'HTTP 429 Too Many Requests')).toBe(true);
  });

  it('should detect HTTP 502 as transient', () => {
    expect(isTransientFailure(1, 'Bad Gateway (HTTP 502)')).toBe(true);
  });

  it('should detect HTTP 503 as transient', () => {
    expect(isTransientFailure(1, 'Service unavailable')).toBe(true);
  });

  it('should detect socket hang up as transient', () => {
    expect(isTransientFailure(1, 'Error: socket hang up')).toBe(true);
  });

  it('should detect overloaded as transient', () => {
    expect(isTransientFailure(1, 'API is overloaded')).toBe(true);
  });

  it('should detect ECONNREFUSED as transient', () => {
    expect(isTransientFailure(1, 'ECONNREFUSED 127.0.0.1:443')).toBe(true);
  });

  it('should detect ENOTFOUND as transient', () => {
    expect(isTransientFailure(1, 'getaddrinfo ENOTFOUND api.anthropic.com')).toBe(true);
  });

  it('should NOT detect a normal error as transient', () => {
    expect(isTransientFailure(1, 'SyntaxError: Unexpected token')).toBe(false);
  });

  it('should NOT detect exit code 0 as transient', () => {
    expect(isTransientFailure(0, '')).toBe(false);
  });

  it('should NOT detect a generic exit code 1 with no matching output as transient', () => {
    expect(isTransientFailure(1, 'Permission denied')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isTransientFailure(1, 'TIMEOUT ERROR')).toBe(true);
    expect(isTransientFailure(1, 'Gateway Timeout')).toBe(true);
  });
});

describe('retryDelaySeconds', () => {
  it('should return base delay for first attempt', () => {
    expect(retryDelaySeconds(1, 30, 900)).toBe(30);
  });

  it('should double for each subsequent attempt', () => {
    expect(retryDelaySeconds(2, 30, 900)).toBe(60);
    expect(retryDelaySeconds(3, 30, 900)).toBe(120);
    expect(retryDelaySeconds(4, 30, 900)).toBe(240);
  });

  it('should cap at maxSeconds', () => {
    expect(retryDelaySeconds(10, 30, 900)).toBe(900);
    expect(retryDelaySeconds(20, 30, 900)).toBe(900);
  });

  it('should use default values', () => {
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(5)).toBe(480);
  });

  it('should respect custom base and max', () => {
    expect(retryDelaySeconds(1, 10, 100)).toBe(10);
    expect(retryDelaySeconds(4, 10, 100)).toBe(80);
    expect(retryDelaySeconds(5, 10, 100)).toBe(100);
  });
});
